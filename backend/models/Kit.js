import mongoose from 'mongoose';

// A kit is either a saved product filter (query) or a hand-picked list of SKUs.
const kitSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  query: { type: Map, of: String },
  productIds: [String]
}, { timestamps: true });

kitSchema.pre('validate', function requireContents() {
  if (!this.query?.size && !this.productIds.length) {
    this.invalidate('query', 'A kit needs a query or a list of productIds.');
  }
});

export default mongoose.model('Kit', kitSchema);
