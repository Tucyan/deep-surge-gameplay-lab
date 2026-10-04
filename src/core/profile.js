import {META_SHOP,TECH} from '../content/index.js';
export function profileCommand(profile,command){
 const need=(ok,message)=>{if(!ok)throw new Error(message);};
 if(command.type==='BuyMeta'){
  const item=META_SHOP[command.itemId];need(item,'未知局外商品');const count=profile.purchases[command.itemId]||0;need(count<item.maxPurchases,'已达到购买上限');need(profile.points>=item.price,'涌潮点不足');profile.points-=item.price;profile.purchases[command.itemId]=count+1;
  if(['supply','blessing'].includes(command.itemId))profile.pending[command.itemId]=(profile.pending[command.itemId]||0)+1;
 }else if(command.type==='UnlockTech'){
  const item=TECH[command.techId];need(item,'未知科技');need(!profile.tech.includes(command.techId),'已经解锁');need(item.requires.every(id=>profile.tech.includes(id)),'先解锁前置科技');need(profile.points>=item.price,'涌潮点不足');profile.points-=item.price;profile.tech.push(command.techId);
 }
}
