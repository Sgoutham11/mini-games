import { LOGGER_URL } from "../config";


  
export class LoggerService {


  constructor( ) {}

   static  async  debugLog(...args: any[]) {

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
  

}
