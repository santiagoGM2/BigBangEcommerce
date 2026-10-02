import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { adminFetch } from "./product-images/remote";

config({ path: ".env.local", quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Faltan credenciales de Supabase.");
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: adminFetch() } });
const paths = [
  "drive/1-eCQ9HLf2ozSB2Y1-49P5zGy4f2HKC3y/2bdf43616c5dd720654e23904f1b3a6ce7872e6c3c0b8837bbde0bc09dcd71cb/034738-26.webp",
  "drive/10-yra8NlD3mTzJKEi_WaJE69srUptwJM/5f4647ccc96c3f4853311b48a9f6776831eb8b1b6f40a4b63db1d654e26598f0/034738-23.webp",
  "drive/14GaZ0HHVpRCJQFQtB6Qfzr4JZDV2kni-/b008ffbedcf1b010d073e952dc6f392ed9a2a94742887187fc69e8df7a8de714/034738-21.webp",
  "drive/15u36MDcZeh6BIL_FmNvVNw72RQMtgEjC/14f81cbaecb0628540d2068740c8d4f9ddee1874d9d983c9ac0f86f0208158f5/000257-3.webp",
  "drive/167gicY7gDpJFXNDL4O1r7tqVrw7Oa3tZ/500bc6d2722606081685385939b71647204111d8d848f5762929ee93c4cfcbdf/034738-16.webp",
  "drive/18Nvr0jt-2FYF6XBBmvfPV3AbJfmZASpl/8990af25cdd2228bccebf95854ec053177d92307a2e8c97c76646a9255acc71d/034738-1.webp",
  "drive/1bIpuO5vCoQ70VAXZvAXktjyUaujdl-ok/f1d75acdc30e1f3d97484bc129103784c37a0efb18ac11aaf6109f4fee15c5f5/034738-27.webp",
  "drive/1EenEbn9Wbw_OeixRIT2mc4WZaYNXIGlO/882b55a97b9295f1255effd9d4d8cc62d63b5f6aa7db5354b31139eaa3f55200/000254.webp",
  "drive/1FaARb-swT-m7-3gB8cNXL-_u8x82cE33/3d5ae7d0ba59a2ec49c5ad347fc8fbba717190711d836b04b7d80af914385c74/001604-4.webp",
  "drive/1fgIMfaIv1f8Xgu3-xBHWpcrUx43ucmPS/cccef24f90ec376ee3a343f658dd8b7d66081fb0eee68f1e3c7ae8f33db52d04/034738-19.webp",
  "drive/1g4EOPkNBfkafK66EYC4zWcOnqDTQhsXX/66de5ab3c9ef8dbde14eec0f4e18a8c24df87f6397f97d25b278f024228542b6/034738-2.webp",
  "drive/1gNvFttF2iA5WJEJkCAHv5tbPRM85mV5g/062721f62b3c2825c5a8579baa7bdcd340c27e26d0d7eb7f99ba1a1c6e30625b/034738-4.webp",
  "drive/1j83lSWv5ZErmvnYCUaqKDpndjG-yfuOA/37a6975a045f8b2a33dcaad7aa26d4e9d73b8477fb4d2d9156411fca16201b25/034738-7.webp",
  "drive/1j8jxIdq8sck5Rs_MYOWoc4oi-Xdh6Olj/8c25da89f66e58a0e7c76c990aa1b78c48c4ab66114643f4a34a89bed985a955/034738-13.webp",
  "drive/1JDhVY0CfLDElntrUlSxnrn0Bln5ILlvw/bf3285d9d39b3e9e42d23e6d8e53831b5b2372571688516416bba4a7aae46808/002327.webp",
  "drive/1ktFOqBaQI-c-L927i2gtIpcL04sjN_9K/475e77aa7ac6965d731e6403399de2a30772f55d38e39cfed5bf3765056f39d1/000257-8.webp",
  "drive/1LsIJfCcvwKrN_RpatdUBFDaALf7x48mf/f16188009e35483feb62d846f2eb3f679be26007bf31f9c7a469c9ba0277571e/000257-2.webp",
  "drive/1nHiHJWct9HhBH4x_CLoWVluKaLbizo-A/1ea64317bd417ae252276439a639b8b801bf1eb9908b930bf5276964e9816a63/000257-6.webp",
  "drive/1niNHv8IghX0CNKyAAJ76LLhJgHAECeZ5/c873dfc41ddcbc6f5741613e3b8649dc68935b3cec72e6c7134129e280da09fd/000257-4.webp",
  "drive/1nkPfveaj_4dWl_xj51Ph5toJYajJWFYi/089eb29540880b392a4368802382e3e06826a3e3f5c829802cf81e0e4e0d75be/000689-83.webp",
  "drive/1OGUDO_3QxpV_EvYceeu9YqZuxpNdygRC/230e654c6e95fa81b25a46278c3bfaa0effc951bd5e60b025aa0160167651b19/025002.webp",
  "drive/1pKojKqZiF0bntxhFC-5p93BAaZfQ8hww/2757807d80f4326f52a376a95b3b178eb5bcba72b619147535f0652680df8477/001605-1.webp",
  "drive/1Q_z6ItGRvgT9tYvWuHS1uoSqAE1eVuA9/42059e839a4acd08f7d3d0ec1460f355dec8e6a81a24665165a55a7467844bf0/034738-10.webp",
  "drive/1q4yOYchu5dY1LMWg49Rpv395gvvlu-z7/c8399ceee0a8e115be1135bc4b959c80aea0d2a89ea0feeb40d965ea35160385/034738-20.webp",
  "drive/1QVAdiEqfxKEW7OXZwAEhBMvMsIjmQPwe/1600dee861daec79fe2d5cddcbecfbc7e1590cfb627dd1ef83bdc12c9884ce7a/001604-9.webp",
  "drive/1R1cNWjiwZCPUczFyf_JQtPpsKjcvyUt4/a8bf6a285bf060dc0aa3ce93da017e79c490ee7c33e6410273837c3c02ef1054/000257-5.webp",
  "drive/1rhbIKwE9Z07pDX9tqDqHnitY-i9gZMmB/91312543dc616518c329dbceba389f34f7ebba2d020154a80ccb6bb2697ea5c4/001605-2.webp",
  "drive/1shrrR29ejySwuGnKQP2zAw1OP8cga0nl/2d4c47566e196f1e78054ab2d96e3ef8274c85f50bb31b7892dd6a787425535c/025003.webp",
  "drive/1soii7AsEnil2bXMbpQKSRfgWS46X4YV_/18c29a53c16be62d62b2a1c9bda8f5f6d577ea90bb5113ab4235b243093ca78d/000257-7.webp",
  "drive/1T--th-ctepnGbN_xiAiN9_L_HfkujczH/fa2dd97347d6626adc4f9bdf6a3cdc6d65b613499f55b07afa51307c76d12bbf/003806-1.webp",
  "drive/1uu0tJ8_m7Hqe7SaxRcLueTPovN1v2965/682b4c91bf9891e372756f6a7f715ba18ad22ef261c533eb71477c106d1e8adf/000251.webp",
  "drive/1vhp7-4_Ol7-od4NxuWXgE4MolD1FpAeD/13dddc5445d08a5f6189232461457867cc532053478385e5232463fb9e9f5a1d/000257-1.webp"
];
const sourceKeys = [
  "1-eCQ9HLf2ozSB2Y1-49P5zGy4f2HKC3y",
  "10-yra8NlD3mTzJKEi_WaJE69srUptwJM",
  "14GaZ0HHVpRCJQFQtB6Qfzr4JZDV2kni-",
  "15u36MDcZeh6BIL_FmNvVNw72RQMtgEjC",
  "167gicY7gDpJFXNDL4O1r7tqVrw7Oa3tZ",
  "18Nvr0jt-2FYF6XBBmvfPV3AbJfmZASpl",
  "1bIpuO5vCoQ70VAXZvAXktjyUaujdl-ok",
  "1EenEbn9Wbw_OeixRIT2mc4WZaYNXIGlO",
  "1FaARb-swT-m7-3gB8cNXL-_u8x82cE33",
  "1fgIMfaIv1f8Xgu3-xBHWpcrUx43ucmPS",
  "1g4EOPkNBfkafK66EYC4zWcOnqDTQhsXX",
  "1gNvFttF2iA5WJEJkCAHv5tbPRM85mV5g",
  "1j83lSWv5ZErmvnYCUaqKDpndjG-yfuOA",
  "1j8jxIdq8sck5Rs_MYOWoc4oi-Xdh6Olj",
  "1JDhVY0CfLDElntrUlSxnrn0Bln5ILlvw",
  "1ktFOqBaQI-c-L927i2gtIpcL04sjN_9K",
  "1LsIJfCcvwKrN_RpatdUBFDaALf7x48mf",
  "1nHiHJWct9HhBH4x_CLoWVluKaLbizo-A",
  "1niNHv8IghX0CNKyAAJ76LLhJgHAECeZ5",
  "1nkPfveaj_4dWl_xj51Ph5toJYajJWFYi",
  "1OGUDO_3QxpV_EvYceeu9YqZuxpNdygRC",
  "1pKojKqZiF0bntxhFC-5p93BAaZfQ8hww",
  "1Q_z6ItGRvgT9tYvWuHS1uoSqAE1eVuA9",
  "1q4yOYchu5dY1LMWg49Rpv395gvvlu-z7",
  "1QVAdiEqfxKEW7OXZwAEhBMvMsIjmQPwe",
  "1R1cNWjiwZCPUczFyf_JQtPpsKjcvyUt4",
  "1rhbIKwE9Z07pDX9tqDqHnitY-i9gZMmB",
  "1shrrR29ejySwuGnKQP2zAw1OP8cga0nl",
  "1soii7AsEnil2bXMbpQKSRfgWS46X4YV_",
  "1T--th-ctepnGbN_xiAiN9_L_HfkujczH",
  "1uu0tJ8_m7Hqe7SaxRcLueTPovN1v2965",
  "1vhp7-4_Ol7-od4NxuWXgE4MolD1FpAeD"
];
const productIds = [
  "034738",
  "000257",
  "000254",
  "001604",
  "002327",
  "000689",
  "025002",
  "001605",
  "025003",
  "003806",
  "000251"
];

async function main() {
  const checks = await Promise.all([
    admin.from("producto_imagen_importaciones").select("source_key", { count: "exact", head: true }).in("source_key", sourceKeys),
    admin.from("producto_imagenes").select("id", { count: "exact", head: true }).in("id_item", productIds),
    admin.from("producto_extra").select("id_item", { count: "exact", head: true }).in("id_item", productIds).not("foto_url", "is", null),
  ]);
  for (const check of checks) {
    if (check.error) throw check.error;
    if (check.count !== 0) throw new Error("Aun hay fotos relacionadas; no se elimina Storage.");
  }
  const { data, error } = await admin.storage.from("productos").remove(paths);
  if (error) throw error;
  console.log(JSON.stringify({ requested: paths.length, removed: data?.length ?? 0 }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
