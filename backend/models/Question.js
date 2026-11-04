import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, trim: true, maxlength: 500 },
  answer: { type: String, trim: true, maxlength: 1000 }
}, { timestamps: true });

export default mongoose.model('Question', questionSchema);
