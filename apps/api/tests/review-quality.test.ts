import request from 'supertest';
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {app,ensureSeed,pool,registerAgent,futureEventPayload} from './helpers.js';
import {isOpenNow} from '../src/services/schedule.js';
import {sampleMedia} from '../src/seed/media.js';
import {seedEvents} from '../src/seed/data.js';
beforeAll(ensureSeed);
afterAll(()=>pool.end());
describe('review quality',()=>{
  it('has sourced illustrative photographs for the entire demo catalogue',()=>{
    expect(Object.keys(sampleMedia)).toHaveLength(30);
    for(const e of seedEvents){
      expect(sampleMedia[e.slug]?.image).toMatch(/^https:\/\//);
      expect(sampleMedia[e.slug]?.details.imageSource).toMatch(/^https:\/\/unsplash.com\/photos\//);
      expect(sampleMedia[e.slug]?.details.imageCredit).toBeTruthy();
      expect(sampleMedia[e.slug]?.details.imageIllustrative).toBe(true);
    }
  });
  it('keeps draft details private and prevents booking a draft',async()=>{
    const owner=await registerAgent('organizer'), stranger=await registerAgent('attendee');
    const created=await owner.agent.post('/api/organizer/events').send(futureEventPayload({publicationStatus:'draft'}));
    expect(created.status).toBe(201);
    const e=created.body.event;
    expect((await request(app).get('/api/events/'+e.id)).status).toBe(404);
    expect((await stranger.agent.get('/api/events/'+e.id)).status).toBe(404);
    expect((await owner.agent.get('/api/events/'+e.id)).status).toBe(200);
    expect((await stranger.agent.post('/api/events/'+e.id+'/bookings').send({seats:1})).status).toBe(404);
    const listed=await owner.agent.get('/api/events?status=all&limit=100');
    expect(listed.body.events.some((x:{id:number})=>x.id===e.id)).toBe(false);
  });
  it('preserves venue coordinates and local covers when editing other fields',async()=>{
    const owner=await registerAgent('organizer');
    const payload=futureEventPayload({lat:24.441,lng:39.619,imageUrl:'/assets/events/book-fair.webp',details:{locationAccuracy:'exact'}});
    const made=await owner.agent.post('/api/organizer/events').send(payload);
    const changed=await owner.agent.put('/api/organizer/events/'+made.body.event.id).send({...payload,lat:undefined,lng:undefined,title:'عنوان جديد مع نفس المكان'});
    expect(changed.status).toBe(200); expect(changed.body.event.lat).toBe(24.441);
    expect(changed.body.event.image).toBe('/assets/events/book-fair.webp');
  });
  it('snapshots booking price and keeps every analytics series in one date range',async()=>{
    const owner=await registerAgent('organizer'), visitor=await registerAgent('attendee');
    const payload=futureEventPayload({price:20,capacity:10});
    const made=await owner.agent.post('/api/organizer/events').send(payload);const id=made.body.event.id;
    expect((await visitor.agent.post('/api/events/'+id+'/bookings').send({seats:2})).status).toBe(201);
    await owner.agent.put('/api/organizer/events/'+id).send({...payload,price:70});
    for(const days of [7,14,30]){
      const a=await owner.agent.get('/api/organizer/events/'+id+'/analytics?days='+days);
      expect(a.status).toBe(200);expect(a.body.daily).toHaveLength(days);
      expect(a.body.revenue).toBe(40);expect(a.body.funnel.seats).toBe(2);
      expect(a.body.daily.reduce((n:number,d:{bookings:number})=>n+d.bookings,0)).toBe(a.body.funnel.bookings);
    }
  });
  it('deduplicates concurrent/reloaded views on the server',async()=>{
    const owner=await registerAgent('organizer');
    const made=await owner.agent.post('/api/organizer/events').send(futureEventPayload());const id=made.body.event.id;
    await Promise.all(Array.from({length:4},()=>request(app).post('/api/track').send({type:'view',eventId:id,sessionId:'review-dedup-session',source:'list'})));
    const r=await pool.query("SELECT COUNT(*)::int AS n FROM interactions WHERE event_id=$1 AND session_id=$2 AND type='view'",[id,'review-dedup-session']);
    expect(r.rows[0].n).toBe(1);
  });
  it('does not claim unknown multi-day hours are open',()=>{
    const start=new Date('2026-10-20T13:00Z'),end=new Date('2026-10-30T20:00Z');
    expect(isOpenNow(start,end,{},new Date('2026-10-27T10:00Z'))).toBeNull();
    expect(isOpenNow(start,end,{dailyStart:'16:00',dailyEnd:'23:00'},new Date('2026-10-27T10:00Z'))).toBe(false);
    expect(isOpenNow(start,end,{dailyStart:'16:00',dailyEnd:'23:00'},new Date('2026-10-27T17:00Z'))).toBe(true);
    expect(isOpenNow(start,end,{dailyStart:'20:00',dailyEnd:'02:00'},new Date('2026-10-27T22:00Z'))).toBe(true);
  });
});
