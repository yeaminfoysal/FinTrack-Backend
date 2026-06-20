/** Shape attached to request.user by JwtStrategy.validate(). */
export interface AuthUser {
  userId: string;
  email: string;
}
