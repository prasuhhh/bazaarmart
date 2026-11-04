import Shelf from '../models/Shelf.js';
import User from '../models/User.js';
import { isValidAge, isValidEmail, isValidPassword, isValidUsername } from '../middleware/validate.js';
import { ApiError, created, noContent, ok } from '../utils/response.js';
import { createSession, publicUser } from '../utils/session.js';

async function saveProfile(userId, updates) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, 'User not found.');
  user.set(updates);
  await user.save(); // save(), not findOneAndUpdate, so a new password gets hashed
  return publicUser(user);
}

export async function getMe(req, res) {
  const user = await User.findById(req.user.userId);
  if (!user) throw new ApiError(404, 'User not found.');
  ok(res, { data: user });
}

export async function register(req, res) {
  const { username, emailId, age, password } = req.body;
  if (!isValidUsername(username) || !isValidEmail(emailId) || !isValidAge(age) || !isValidPassword(password)) {
    throw new ApiError(400, 'Enter a valid username (at least 2 characters), email, age (1–120), and password (at least 6 characters).');
  }
  const normalizedEmail = emailId.toLowerCase().trim();
  if (await User.exists({ emailId: normalizedEmail })) throw new ApiError(409, 'Email ID is already registered.');

  // Fields are listed one by one so a client can never set its own role.
  const user = await User.create({
    username: username.trim(),
    emailId: normalizedEmail,
    age: Number(age),
    password
  });
  created(res, { message: `Successfully registered! Welcome, ${user.username}.` });
}

export async function login(req, res) {
  const { emailId, password } = req.body;
  if (!isValidEmail(emailId) || typeof password !== 'string' || !password) {
    throw new ApiError(400, 'Enter a valid email ID and password.');
  }
  const user = await User.findOne({ emailId: emailId.toLowerCase().trim() }).select('+password');
  if (!user) throw new ApiError(404, 'User Not Registered.');
  if (!(await user.comparePassword(password))) throw new ApiError(401, 'Invalid Password.');

  ok(res, { message: 'Login successful.', data: createSession(user) });
}

export async function updateProfile(req, res) {
  const { username, age, password } = req.body;
  if (!isValidUsername(username) || !isValidAge(age) || !isValidPassword(password)) {
    throw new ApiError(400, 'PUT needs a valid username, age, and password (at least 6 characters).');
  }
  const updates = { username: username.trim(), age: Number(age), password };

  ok(res, { message: 'Profile updated successfully.', data: await saveProfile(req.user.userId, updates) });
}

function editableFields({ username, age, password }) {
  const updates = {};
  if (username !== undefined) {
    if (!isValidUsername(username)) throw new ApiError(400, 'Username must contain at least 2 characters.');
    updates.username = username.trim();
  }
  if (age !== undefined) {
    if (!isValidAge(age)) throw new ApiError(400, 'Age must be between 1 and 120.');
    updates.age = Number(age);
  }
  if (password !== undefined) {
    if (!isValidPassword(password)) throw new ApiError(400, 'Password must contain at least 6 characters.');
    updates.password = password;
  }
  return updates;
}

export async function patchProfile(req, res) {
  const updates = editableFields(req.body);
  if (!Object.keys(updates).length) throw new ApiError(400, 'Provide at least one editable field.');
  ok(res, { message: 'Selected profile fields updated.', data: await saveProfile(req.user.userId, updates) });
}

// Phone accounts have no email for the ?emailId= routes, so these use the session.
// They can add an email once; after that it's read-only, like every other account.
export async function patchMe(req, res) {
  const updates = editableFields(req.body);
  const { emailId } = req.body;
  if (emailId !== undefined) {
    if (req.user.emailId) throw new ApiError(400, 'Your email ID can\'t be changed.');
    if (!isValidEmail(emailId)) throw new ApiError(400, 'Enter a valid email ID.');
    updates.emailId = emailId.toLowerCase().trim();
  }
  if (!Object.keys(updates).length) throw new ApiError(400, 'Provide at least one editable field.');
  ok(res, { message: 'Selected profile fields updated.', data: await saveProfile(req.user.userId, updates) });
}

// Orders stay as records. Shelves go, or their public links would outlive the account.
async function removeAccount(userId) {
  const user = await User.findByIdAndDelete(userId);
  if (!user) throw new ApiError(404, 'User not found.');
  await Shelf.deleteMany({ user: user._id });
}

export async function deleteAccount(req, res) {
  await removeAccount(req.user.userId);
  noContent(res);
}
