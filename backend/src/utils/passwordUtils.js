import bcrypt from 'bcrypt';


export function isHashed(str) {
  try {
    // If str is a valid bcrypt hash, this returns the round count (e.g. 10)
    bcrypt.getRounds(str);
    return true;
  } catch (err) {
    // If it wasn’t a valid hash, bcrypt throws an error
    return false;
  }
}
