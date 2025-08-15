// Authentication related types

// Base form data interface (matches register.tsx)
interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  first_name: string;
  last_name: string;
  organization: string;
}

// Export the same type definition as in register.tsx
export type RegisterUserData = Omit<RegisterFormData, 'confirmPassword'>;

