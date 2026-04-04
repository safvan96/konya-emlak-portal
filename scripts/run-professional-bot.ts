import { runProfessionalBot } from "../src/lib/scraper/professional-bot";

runProfessionalBot().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
