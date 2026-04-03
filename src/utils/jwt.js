/**
 * Decode JWT token and extract payload
 * @param {string} token - JWT token
 * @returns {object|null} - Decoded payload or null if invalid
 */
export function decodeJwt(token) {
  if (!token) return null;
  
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
}

/**
 * Check if user has admin role from JWT token
 * @param {string} token - JWT token
 * @returns {boolean} - True if user is admin
 */
export function isAdminFromToken(token) {
  const payload = decodeJwt(token);
  if (!payload) return false;
  
  // Check common role claim patterns
  const roles = payload.roles || payload.authorities || payload.role || [];
  
  // Handle different role formats
  if (Array.isArray(roles)) {
    return roles.some(role => 
      role === 'ROLE_ADMIN' || 
      role === 'ADMIN' || 
      role?.authority === 'ROLE_ADMIN'
    );
  }
  
  // Handle string role
  if (typeof roles === 'string') {
    return roles === 'ROLE_ADMIN' || roles === 'ADMIN';
  }
  
  return false;
}

/**
 * Get user info from JWT token
 * @param {string} token - JWT token
 * @returns {object|null} - User info object
 */
export function getUserInfoFromToken(token) {
  const payload = decodeJwt(token);
  if (!payload) return null;
  
  return {
    username: payload.username || payload.sub || payload.userName || payload.email,
    email: payload.email || payload.sub,
    isAdmin: isAdminFromToken(token),
    exp: payload.exp,
    iat: payload.iat
  };
}

/**
 * Check if token is expired
 * @param {string} token - JWT token
 * @returns {boolean} - True if token is expired
 */
export function isTokenExpired(token) {
  const payload = decodeJwt(token);
  if (!payload || !payload.exp) return true;
  
  const now = Date.now() / 1000;
  return payload.exp < now;
}
