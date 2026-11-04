import Product from '../models/Product.js';
import Question from '../models/Question.js';
import Review from '../models/Review.js';
import { ApiError, created, ok } from '../utils/response.js';

async function productFor(req) {
  const product = await Product.findOne({ productId: req.params.productId });
  if (!product) throw new ApiError(404, 'Product not found.');
  return product;
}

// Only the username is joined, so a public product page never exposes contact details.
async function listFor(Model, req, res) {
  const product = await productFor(req);
  const entries = await Model.find({ product: product._id })
    .select('-__v -product')
    .populate('user', 'username')
    .sort({ createdAt: -1 });
  ok(res, { data: entries, count: entries.length });
}

export const listReviews = (req, res) => listFor(Review, req, res);
export const listQuestions = (req, res) => listFor(Question, req, res);

export async function addReview(req, res) {
  const product = await productFor(req);
  const { rating, text } = req.body;
  const review = await Review.create({ product: product._id, user: req.user.userId, rating, text });
  created(res, { message: 'Thanks for your review.', data: review });
}

export async function addQuestion(req, res) {
  const product = await productFor(req);
  const question = await Question.create({ product: product._id, user: req.user.userId, text: req.body.text });
  created(res, { message: 'Question posted.', data: question });
}
