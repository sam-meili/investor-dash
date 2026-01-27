#!/usr/bin/env node

/**
 * Password Hashing Utility for PBKDF2
 * 
 * Usage:
 *   node scripts/hash-password.js "YourPassword"
 * 
 * This will generate a PBKDF2-HMAC-SHA256 hash that you can store
 * in the investor_password.password_hash column.
 * 
 * Hash format: iterations$salt(base64)$hash(base64)
 * Example: 100000$aGVsbG93b3JsZA==$5K8n7N3M9P2Q4R5S6T7U8V9W0X1Y2Z3A4B5C6D7E8F9G==
 */

import crypto from 'crypto';

const ITERATIONS = 100000;  // OWASP recommended minimum
const HASH_LENGTH = 32;      // 32 bytes = 256 bits
const SALT_LENGTH = 16;      // 16 bytes = 128 bits

/**
 * Hash a password using PBKDF2-HMAC-SHA256
 * @param {string} password - The password to hash
 * @returns {Promise<string>} - The formatted hash string
 */
async function hashPassword(password) {
  return new Promise((resolve, reject) => {
    // Generate random salt
    const salt = crypto.randomBytes(SALT_LENGTH);
    
    // Generate hash
    crypto.pbkdf2(password, salt, ITERATIONS, HASH_LENGTH, 'sha256', (err, derivedKey) => {
      if (err) {
        reject(err);
        return;
      }
      
      // Encode salt and hash as base64
      const saltBase64 = salt.toString('base64');
      const hashBase64 = derivedKey.toString('base64');
      
      // Format: iterations$salt$hash
      const formattedHash = `${ITERATIONS}$${saltBase64}$${hashBase64}`;
      resolve(formattedHash);
    });
  });
}

/**
 * Verify a password against a stored hash
 * @param {string} password - The password to verify
 * @param {string} storedHash - The stored hash to verify against
 * @returns {Promise<boolean>} - True if password matches
 */
async function verifyPassword(password, storedHash) {
  return new Promise((resolve, reject) => {
    try {
      // Parse the stored hash
      const parts = storedHash.split('$');
      if (parts.length !== 3) {
        resolve(false);
        return;
      }
      
      const [iterationsStr, saltBase64, hashBase64] = parts;
      const iterations = parseInt(iterationsStr, 10);
      
      if (isNaN(iterations)) {
        resolve(false);
        return;
      }
      
      // Decode salt and hash
      const salt = Buffer.from(saltBase64, 'base64');
      const storedHashBuffer = Buffer.from(hashBase64, 'base64');
      
      // Hash the input password with the same salt
      crypto.pbkdf2(password, salt, iterations, HASH_LENGTH, 'sha256', (err, derivedKey) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Constant-time comparison
        resolve(crypto.timingSafeEqual(storedHashBuffer, derivedKey));
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Main CLI execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('Error: No password provided');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/hash-password.js "YourPassword"');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/hash-password.js "MySecurePassword123!"');
    console.log('  node scripts/hash-password.js "investor_view_2024"');
    console.log('');
    process.exit(1);
  }
  
  const password = args[0];
  
  if (password.length < 8) {
    console.warn('Warning: Password is less than 8 characters. Consider using a stronger password.');
    console.log('');
  }
  
  try {
    console.log('Hashing password...');
    console.log('');
    
    const hash = await hashPassword(password);
    
    console.log('✅ Password hashed successfully!');
    console.log('');
    console.log('Hash (copy this to your database):');
    console.log('━'.repeat(80));
    console.log(hash);
    console.log('━'.repeat(80));
    console.log('');
    console.log('SQL Update Command:');
    console.log('━'.repeat(80));
    console.log(`UPDATE investor_password`);
    console.log(`SET password_hash = '${hash}'`);
    console.log(`WHERE id = 'your-user-id';  -- Replace with actual user ID`);
    console.log('━'.repeat(80));
    console.log('');
    
    // Verify the hash works
    console.log('Verifying hash...');
    const isValid = await verifyPassword(password, hash);
    
    if (isValid) {
      console.log('✅ Verification successful! Hash is valid.');
    } else {
      console.error('❌ Verification failed! Hash is invalid.');
      process.exit(1);
    }
    
    console.log('');
    console.log('Hash Details:');
    console.log(`  Algorithm: PBKDF2-HMAC-SHA256`);
    console.log(`  Iterations: ${ITERATIONS.toLocaleString()}`);
    console.log(`  Salt Length: ${SALT_LENGTH} bytes`);
    console.log(`  Hash Length: ${HASH_LENGTH} bytes`);
    console.log('');
    
  } catch (error) {
    console.error('Error hashing password:', error.message);
    process.exit(1);
  }
}

// Run the CLI
main();
