import { z } from "zod";
import { requestIdSchema } from "./common";

/** Masukan `buy_analysis`: hanya `request_id` (idempotensi). Aturan bisnis ditegakkan database. */
export const buyAnalysisSchema = z.object({ requestId: requestIdSchema });
