import {defineConfig} from '@neon/config/v1';
export default defineConfig({
 auth:true,
 aiGateway:true,
 buckets:{'closet-images':{access:'private'}},
 functions:{api:{
  name:'OOOOTD API',
  source:'backend/index.mjs',
  env:{
   OOOOTD_DATABASE_URL:{value:process.env.OOOOTD_DATABASE_URL,required:true},
   GEMINI_API_KEY:{value:process.env.GEMINI_API_KEY,required:false,onUndefined:'skip'},
   GEMINI_MODEL:{value:process.env.GEMINI_MODEL,required:false,onUndefined:'skip'}
  }
 }},
 triggers:{'weekly-catalog':{type:'schedule',function:'api',cron:'0 0 * * 1',functionPath:'/cron/catalog'}}
});
