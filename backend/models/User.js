import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true, minlength: 2 },
  emailId: { type: String, required: true, unique: true, lowercase: true, trim: true },
  age: { type: Number, required: true, min: 1, max: 120 },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' }
}, { timestamps: true });

export default mongoose.model('User', userSchema);
