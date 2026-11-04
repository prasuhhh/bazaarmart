import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { isValidAge, isValidEmail, isValidPassword, isValidUsername } from '../middleware/validate.js';
import { created, fail, ok } from '../utils/response.js';

const publicUser = user => ({ username: user.username, emailId: user.emailId, age: user.age, role: user.role });

async function saveProfile(emailId, updates) {
  const user = await User.findOneAndUpdate({ emailId }, updates, { new: true, runValidators: true });
  if (!user) throw fail(404, 'User not found.');
  return publicUser(user);
}

export async function register(req, res) {
  const { username, emailId, age, password } = req.body;
  if (!isValidUsername(username) || !isValidEmail(emailId) || !isValidAge(age) || !isValidPassword(password)) {
    throw fail(400, 'Enter a valid username (at least 2 characters), email, age (1–120), and password (at least 6 characters).');
  }
  const normalizedEmail = emailId.toLowerCase().trim();
  if (await User.exists({ emailId: normalizedEmail })) throw fail(409, 'Email ID is already registered.');

  // Fields are listed one by one so a client can never set its own role.
  const user = await User.create({
    username: username.trim(),
    emailId: normalizedEmail,
    age: Number(age),
    password: await bcrypt.hash(password, 10)
  });
  created(res, { message: `Successfully registered! Welcome, ${user.username}.` });
}

export async function login(req, res) {
  const { emailId, password } = req.body;
  if (!isValidEmail(emailId) || typeof password !== 'string' || !password) {
    throw fail(400, 'Enter a valid email ID and password.');
  }
  const user = await User.findOne({ emailId: emailId.toLowerCase().trim() }).select('+password');
  if (!user) throw fail(404, 'User Not Registered.');
  if (!(await bcrypt.compare(password, user.password))) throw fail(401, 'Invalid Password.');

  const token = jwt.sign({ userId: user._id, emailId: user.emailId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '2h'
  });
  ok(res, { message: 'Login successful.', data: { token, user: publicUser(user) } });
}

export async function updateProfile(req, res) {
  const { username, age, password } = req.body;
  if (!isValidUsername(username) || !isValidAge(age) || (password !== undefined && !isValidPassword(password))) {
    throw fail(400, 'Provide a valid username, age, and optional password (at least 6 characters).');
  }
  const updates = { username: username.trim(), age: Number(age) };
  if (password) updates.password = await bcrypt.hash(password, 10);

  ok(res, { message: 'Profile updated successfully.', data: await saveProfile(req.user.emailId, updates) });
}

export async function patchProfile(req, res) {
  const { username, age, password } = req.body;
  if (username === undefined && age === undefined && password === undefined) {
    throw fail(400, 'Provide at least one editable field.');
  }
  const updates = {};
  if (username !== undefined) {
    if (!isValidUsername(username)) throw fail(400, 'Username must contain at least 2 characters.');
    updates.username = username.trim();
  }
  if (age !== undefined) {
    if (!isValidAge(age)) throw fail(400, 'Age must be between 1 and 120.');
    updates.age = Number(age);
  }
  if (password !== undefined) {
    if (!isValidPassword(password)) throw fail(400, 'Password must contain at least 6 characters.');
    updates.password = await bcrypt.hash(password, 10);
  }

  ok(res, { message: 'Selected profile fields updated.', data: await saveProfile(req.user.emailId, updates) });
}

export async function deleteAccount(req, res) {
  const user = await User.findOneAndDelete({ emailId: req.user.emailId });
  if (!user) throw fail(404, 'User not found.');
  ok(res, { message: 'User registration deleted successfully.' });
}
