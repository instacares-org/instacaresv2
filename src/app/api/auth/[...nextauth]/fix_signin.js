const fs = require('fs');

const content = fs.readFileSync('options.ts', 'utf8');

// Find and replace the signIn callback
const oldSignIn = ;

const newSignIn = ;

const newContent = content.replace(oldSignIn, newSignIn);

if (newContent !== content) {
  fs.writeFileSync('options.ts', newContent);
  console.log('Successfully updated signIn callback');
} else {
  console.log('Pattern not found - content unchanged');
}
