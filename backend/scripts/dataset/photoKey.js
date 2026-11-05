// Commons adds tracking to its file links and Openverse doesn't, so one photo can arrive under two
// URLs. Rejections and verdicts compare this key, which keeps a rejected photo from coming back.
export const photoKey = url => (url?.includes('upload.wikimedia.org') ? url.split('?')[0] : url);
