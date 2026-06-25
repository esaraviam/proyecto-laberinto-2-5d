import { inicializar, buclePrincipal, disparar } from './game.js';
import { onDisparo, onReinicio } from './input.js';

onDisparo(disparar);
onReinicio(inicializar);

inicializar();
buclePrincipal();
