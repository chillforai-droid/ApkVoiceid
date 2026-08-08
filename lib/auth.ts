import { createClient } from "@supabase/supabase-js";
import { VercelRequest } from "@vercel/node";

export const supabaseAdmin = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const verifyAuth = async (req: VercelRequest) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return null;
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (error || !user) return null;
    return user;
};
