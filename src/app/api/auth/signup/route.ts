import { lucia } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { Argon2id } from "oslo/password";
import { db } from "@/lib/db";
import { generateId } from "lucia";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body.email?.toString();
    const password = body.password?.toString();
    const firstName = body.firstName?.toString();
    const lastName = body.lastName?.toString();
    const organizationName = body.organizationName?.toString() || `${firstName}'s Organization`;

    if (!email || !password || email.length < 3 || password.length < 6) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "User already exists" },
        { status: 400 }
      );
    }

    const hashedPassword = await new Argon2id().hash(password);
    const userId = generateId(15);
    const organizationId = generateId(15);

    // Create organization and user in a transaction
    const user = await db.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          id: organizationId,
          name: organizationName,
          slug: `org-${organizationId.slice(0, 8)}`,
        },
      });

      // Create user
      return await tx.user.create({
        data: {
          id: userId,
          email,
          firstName,
          lastName,
          hashed_password: hashedPassword,
          organizationId: organization.id,
          role: "OWNER", // First user is owner
        },
      });
    });

    // Create session
    const session = await lucia.createSession(user.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);

    (await cookies()).set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes
    );

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    });
  } catch (error: any) {
    console.error("Signup error:", error);

    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Email already taken" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "An unknown error occurred" },
      { status: 500 }
    );
  }
}
