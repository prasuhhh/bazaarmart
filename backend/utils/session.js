import jwt from 'jsonwebtoken';

export const publicUser = user => ({
  username: user.username,
  emailId: user.emailId,
  phone: user.phone,
  age: user.age,
  role: user.role
});

export function createSession(user) {
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '2h'
  });
  return { token, user: publicUser(user) };
}
