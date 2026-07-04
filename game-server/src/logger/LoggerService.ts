

const LOGGER_URL = process.env.LOGGER_URL || 'http://localhost:7071/telegram-bot-buddy/logs/print';
  
export class LoggerService {


  constructor( ) {}

   static  async debugLog(...args: any[]) {

    console.log(...args);

    try {

        await fetch(LOGGER_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                level: "INFO",
                message: args
                    .map(a =>
                        typeof a === "object"
                            ? JSON.stringify(a)
                            : String(a)
                    )
                    .join(" ")
            })
        });

    } catch (e) {
        console.error(e);
    }
}
  
  cancelAllTimers(): void {
    // for (const [roomCode] of this.activeTimers) {
    //   this.cancelTimer(roomCode);
    // }                                             
  }
}
