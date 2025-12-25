/// <reference types="lucia" />
declare namespace Lucia {
  type Auth = import("./lib/auth").Auth; // Adjust path if your lucia.ts is elsewhere
  type DatabaseUserAttributes = {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    organizationId: string;
    role: string; // Assuming UserRole enum is string
  };
  type DatabaseSessionAttributes = {};
}
