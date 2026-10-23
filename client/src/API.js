const SERVER_URL = 'http://localhost:3001/api';

async function getJson(responsePromise) {
  try {
    const response = await responsePromise;

    let body = {};
    try {
      body = await response.json();
    } catch {
      body = {};
    }

    if (!response.ok) {
      throw body;
    }

    return body;
  } catch (err) {
    if (err && err.error) {
      throw err;
    }

    throw { error: 'Cannot communicate with the server.' };
  }
}

const options = (method, body) => ({
  method,
  credentials: 'include',
  headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const getPublicInfo = () =>
  getJson(fetch(`${SERVER_URL}/public`, { credentials: 'include' }));

const getReservations = () =>
  getJson(fetch(`${SERVER_URL}/reservations`, { credentials: 'include' }));

const createReservation = (reservation) =>
  getJson(fetch(`${SERVER_URL}/reservations`, options('POST', reservation)));

const updateReservation = (id, equipment) =>
  getJson(fetch(`${SERVER_URL}/reservations/${id}`, options('PUT', { equipment })));

const deleteReservation = (id) =>
  getJson(fetch(`${SERVER_URL}/reservations/${id}`, options('DELETE')));

const logIn = (credentials) =>
  getJson(fetch(`${SERVER_URL}/sessions`, options('POST', credentials)));

const getUserInfo = () =>
  getJson(fetch(`${SERVER_URL}/sessions/current`, { credentials: 'include' }));

const logOut = () =>
  getJson(fetch(`${SERVER_URL}/sessions/current`, options('DELETE')));

const verifyTotp = (code) =>
  getJson(fetch(`${SERVER_URL}/login-totp`, options('POST', { code })));

export default {
  getPublicInfo,
  getReservations,
  createReservation,
  updateReservation,
  deleteReservation,
  logIn,
  getUserInfo,
  logOut,
  verifyTotp,
};