import mongoose from 'mongoose'
import timestamps from 'mongoose-timestamp';

const userSchema = mongoose.Schema({
  name: String,
  username: String,
  email: String,
  password: String,
  image: String,
  admin: Boolean,
  isEmailVerified: Boolean,
  verifyEmailToken: String,
  verifyEmailTokenExpires: Date
});

userSchema.plugin(timestamps);

export default mongoose.model('User', userSchema);