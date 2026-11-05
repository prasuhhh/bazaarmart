// Catalogue photos have a 300 px thumb beside the 800 px file. Other images are used as they are.
export const thumbOf = image => image?.replace(/^(\/products\/[A-Z]-\d{2}-\d{3})\.webp$/, '$1-thumb.webp');
