// routes/attendee.js
const express = require('express');
const router  = express.Router();
const db      = global.db;

// list published events + site settings
router.get('/', (req, res, next) => {
  db.get(
    'SELECT name, description FROM site_settings LIMIT 1',
    (e1, settings) => {
      if (e1) return next(e1);
      db.all(
        `SELECT id,title,event_date
           FROM events
          WHERE state='published'
       ORDER BY datetime(event_date) ASC`,
        (e2, events) => {
          if (e2) return next(e2);
          res.render('attendee-home',{
            settings,
            events,
            booked: !!req.query.booked
          });
        }
      );
    }
  );
});

// show single event + tickets
router.get('/events/:id',(req,res,next)=>{
  const eid=req.params.id;
  db.get(
    `SELECT e.*, ss.name, ss.description
       FROM events e
  JOIN site_settings ss ON ss.organiser_id=e.organiser_id
      WHERE e.id=? AND e.state='published'`,
    [eid],
    (e1,event)=>{
      if(e1) return next(e1);
      if(!event) return res.status(404).render('404');
      db.all(
        'SELECT id,type,price,quantity FROM tickets WHERE event_id=?',
        [eid],
        (e2,tickets)=>{
          if(e2) return next(e2);
          res.render('attendee-event',{
            settings:{name:event.name,description:event.description},
            event,tickets,errors:[],formData:{}
          });
        }
      );
    }
  );
});

// handle booking + stock deduction
router.post('/events/:id/book',(req,res,next)=>{
  const eid=req.params.id;
  db.get('SELECT * FROM events WHERE id=? AND state="published"',
    [eid],(e1,event)=>{
      if(e1) return next(e1);
      if(!event) return res.status(404).render('404');
      db.all('SELECT id,quantity FROM tickets WHERE event_id=?',
        [eid],(e2,tickets)=>{
          if(e2) return next(e2);
          const want = tickets.map(t=>({
            id:t.id,
            want:parseInt(req.body[`tickets[${t.id}][quantity]`],10)||0,
            avail:t.quantity
          }));
          const over = want.find(d=>d.want>d.avail);
          if(over){
            return res.render('attendee-event',{
              settings:{},
              event,tickets,
              errors:[{msg:`Only ${over.avail} tickets left.`}],
              formData:req.body
            });
          }
          db.serialize(()=>{
            db.run('BEGIN');
            want.forEach(d=>{
              if(d.want>0){
                db.run('UPDATE tickets SET quantity=quantity-? WHERE id=?',
                  [d.want,d.id]);
                db.run(`INSERT INTO bookings
                          (event_id,ticket_id,buyer_name,qty)
                         VALUES(?,?,?,?)`,
                  [eid,d.id,req.body.name.trim(),d.want]);
              }
            });
            db.run('COMMIT',err3=>{
              if(err3) return next(err3);
              res.redirect('/attendee?booked=1');
            });
          });
        }
      );
    }
  );
});

module.exports = router;
