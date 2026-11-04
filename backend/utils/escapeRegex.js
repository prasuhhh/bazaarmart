// Makes user input safe to place inside a RegExp.
export const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
