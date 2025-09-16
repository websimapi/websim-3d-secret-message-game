export function generateScrambledText(sourceText) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let result = '';
    for (let i = 0; i < sourceText.length; i++) {
        const char = sourceText[i];
        if (/[a-zA-Z]/.test(char)) {
            const randomChar = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
            // Preserve case
            result += (char === char.toUpperCase()) ? randomChar : randomChar.toLowerCase();
        } else {
            result += char; // Keep spaces, punctuation, numbers etc.
        }
    }
    return result;
}

