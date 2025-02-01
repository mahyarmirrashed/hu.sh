const BACKEND_HOST = process.env.REACT_APP_BACKEND_HOST ?? "http://localhost";
const BACKEND_PORT = process.env.REACT_APP_BACKEND_PORT ?? "8000";

export const BASE_API_URL = `${BACKEND_HOST}:${BACKEND_PORT}`;
