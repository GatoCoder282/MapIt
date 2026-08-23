/**
 * Actualizaciones en tiempo real por WebSocket/STOMP (CU-09, RNF03).
 *
 * Debe respetar el kill switch `realtime.websocket`: si la flag está apagada,
 * la app cae a sondeo periódico en vez de dejar de funcionar. Ese es
 * precisamente el caso de uso de un kill switch (ver plan §9).
 *
 * Se implementa en CU-09.
 */
export const REALTIME_VERSION = '0.1.0';
