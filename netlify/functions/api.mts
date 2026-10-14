// Point d'entrée Netlify : toutes les requêtes /api/* arrivent ici.
// Les clés API sont lues dans les variables d'environnement Netlify, jamais exposées au navigateur.
import { handle } from '../../server/router';

export default async (req: Request) => handle(req);

export const config = { path: '/api/*' };
