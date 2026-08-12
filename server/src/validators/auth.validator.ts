import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(24)
    .regex(/^[a-zA-Z0-9._]+$/, "Username may only contain letters, numbers, dots and underscores"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  identifier: z.string().min(1, "Please enter your email or username"),
  password: z.string().min(1, "Please enter your password"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6, "Password must be at least 6 characters"),
});
