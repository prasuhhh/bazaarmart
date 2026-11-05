const FIXED_TITLES = {
  '/map': 'Store map',
  '/saved': 'Saved shelf',
  '/counter': 'Counter · checkout',
  '/orders': 'Orders',
  '/profile': 'Profile',
  '/credits': 'Photo credits',
  '/signin': 'Sign in',
  '/p': 'Product sheet',
  '/track': 'Track parcel',
  '/admin/products': 'Admin · products'
};

export function routeTitle(pathname, zones) {
  if (FIXED_TITLES[pathname]) return FIXED_TITLES[pathname];

  const [, section, id] = pathname.split('/');
  if (section === 'zone') {
    const code = decodeURIComponent(id ?? '').toUpperCase();
    const zone = zones.find(entry => entry.code === code);
    return zone ? `Zone ${zone.code} · ${zone.name}` : `Zone ${code}`;
  }
  if (section === 'p') return `Product sheet · ${decodeURIComponent(id)}`;
  if (section === 'track') return `Track · #${decodeURIComponent(id)}`;
  if (section === 's') return 'Shared shelf';
  return 'Not found';
}
