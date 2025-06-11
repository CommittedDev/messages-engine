"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
class Logger {
    error(message) {
        console.error(message);
    }
    warn(message) {
        console.warn(message);
    }
    info(message) {
        console.info(message);
    }
    debug(message) {
        console.debug(message);
    }
}
exports.logger = new Logger();
