Question:
how can i populate all nested fields like following:

eventIds:
    Event(Model):
      eventAt(field)
      eventName(field):
          EventName(Model):
            eventName(field)
            userId(field)

---

To populate an array of Event references, and within each Event populate its EventName reference, you can use Mongoose’s **nested populate**. Here’s how:

```js
// Assuming your parent schema has:
// eventIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }]

// And your Event schema has:
// eventAt: Date,
// eventName: { type: mongoose.Schema.Types.ObjectId, ref: 'EventName' }

const result = await ParentModel
  .findById(parentId)                        // or .find(), .findOne(), etc.
  .populate({
    path: 'eventIds',                        // first populate the Event docs
    select: 'eventAt eventName',             // only bring back these fields
    populate: {                              // now within each Event…
      path: 'eventName',                     // populate the EventName ref
      model: 'EventName',                    // (only needed if Mongoose can't infer it)
      select: 'name userId'             // only bring back these fields
    }
  })
  .exec();

console.log(result.eventIds);
/* [
     {
       _id: ...,
       eventAt: 2025-07-16T12:34:00.000Z,
       eventName: {
         _id: ...,
         eventName: 'Some Name',
         userId: '605c...'
       }
     },
     …
   ]
*/
```

### Breakdown

1. **`path: 'eventIds'`**
   Targets your array of ObjectId refs to the **Event** model.

2. **`select: 'eventAt eventName'`**
   Limits the fields pulled from each **Event** document to only `eventAt` and the `eventName` reference.

3. **`populate: { path: 'eventName', ... }`**
   Tells Mongoose “within each populated Event, go fetch the `eventName` ref from the **EventName** model.”

4. **`select: 'name userId'`**
   Limits the fields pulled from each **EventName** document.

---

#### Alternative syntax

If you prefer chaining multiple `.populate()` calls:

```js
const result = await ParentModel
  .findById(parentId)
  .populate('eventIds', 'eventAt eventName')           // first level
  .populate('eventIds.eventName', 'name userId')  // nested level
  .exec();
```

Both approaches yield the same structure:

```js
parent.eventIds = [
  {
    _id: ...,
    eventAt: ...,
    eventName: {
      _id: ...,
      eventName: ...,
      userId: ...
    }
  },
  …
];
```

Use whichever style you find more readable.

---

Add this trick inside of if condition for Event and EventName model checking; add new parameter in constructor named populateEvents(= false by default); if this true then populate fields...
