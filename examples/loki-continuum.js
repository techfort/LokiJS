var loki = require('../src/lokijs.js');

/* 
  loki-continuum - a stripped down port of  c#.net program to test capabilities of loki and javascript.  
  Standalone node example, run with :
  "node lokiContinuum"
  
  Demonstrates:
  - Autosave/Autoload
  - using detached loki collections for volatile only use
  - using collection protos to manage 'classed' objects
  - Collection Transforms
  - dot notation
*/

var LokiContinuum = (function() {

var singletonContinuum = null;

// in unix ms time format, this is April 17, 3026 07:15:33 AM
const MAX_DATE = 33333333333333;
const MIN_DATE = 0;

const BalanceTypeEnum = Object.freeze({"HistoricalBalance":1, "VolatileBalance":2, "VolatileTransaction":3, "InceptionBalance":4 });
const FundClassEnum = Object.freeze({"Spending":1, "Debt":2, "DebtEquity":3, "Savings":4 });
const ActorPeriodicityEnum = Object.freeze({'Daily':1, 'Weekly':2, 'Monthly':3, 'Yearly':4, 'OnceOnly':5 });
const ActivityTypeEnum = Object.freeze({'Actor': 1, 'FundReconcile': 2});

function AddDate(unixDate, offset, offsetType) {
  var oldDate = new Date();
  oldDate.setTime(unixDate);
  var year = parseInt(oldDate.getFullYear());
  var month = parseInt(oldDate.getMonth());
  var date = parseInt(oldDate.getDate());
  var hour = parseInt(oldDate.getHours());
  var newDate;

  switch (offsetType) {
    case "years":
    case "Y":
    case "y":
      newDate = new Date(year + offset, month, date, hour);
      break;
    case "months":
    case "M":
    case "m":
      newDate = new Date(year, month + offset, date, hour);
      break;
    case "days":
    case "D":
    case "d":
      newDate = new Date(year, month, date + offset, hour);
      break;
    case "weeks":
    case "W":
    case "w":
      newDate = new Date(year, month, date + offset*7, hour);
      break;
    case "hours":
    case "H":
    case "h":
      newDate = new Date(year, month, date, hour + offset);
      break;
  }

  return newDate.getTime();            
} 


/**
 *
 * Projector - this class is the top level interface to Continuum,
 *     facilitating access to Actors and Funds and a loki database in which is stores them.
 *
 */

function Projector(universeName, dbOptions) {
  // in the absence of establishing db references in funds and actors,
  // nulling that out in toJSON override and providing a custom 
  // inflater to lokijs, i will just force singleton pattern for now
  singletonContinuum = this;

	this.universeName = universeName;
    
  this.enums = {
    BalanceType: BalanceTypeEnum,
    FundClass: FundClassEnum,
    ActorPeriodicity: ActorPeriodicityEnum,
    ActivityType: ActivityTypeEnum
  };
  
  this.MAX_DATE = MAX_DATE;
  this.MIN_DATE = MIN_DATE;

  this.AddDate = AddDate;

  dbOptions.actors = { proto: Actor };
  dbOptions.funds = { proto: Fund };

	this.db = new loki(universeName, dbOptions); 
	this.vol = null;
	this.activities = new loki.Collection("activities");
  
  // Add a parameterized transform to our disconnected collection to determine set of activities affecting a given fundId (sorted by activityDate ascending)

  // If this were a filter function it would read as :
  // ( (obj.activityType === ActivityTypeEnum.FundReconcile) && (obj.affectingFund === fundId) ) || 
  // ( (obj.activityType === ActivityTypeEnum.Actor) && ( (obj.affectingActor.fundPrimary === fundId) || (obj.affectingActor.fundSecondary === fundId) ) )
  
  this.activities.addTransform("DoesAffectFund", [
    { 
      type: 'find',
      value : {
        $or : [
          { activityType: ActivityTypeEnum.FundReconcile, affectingFund : '[%lktxp]fundId' },
          { activityType: ActivityTypeEnum.Actor, $or: [{"affectingActor.fundPrimary": '[%lktxp]fundId'}, {"affectingActor.fundSecondary": '[%lktxp]fundId'}] }
        ]
      }
    },
    {
      type: 'simplesort',
      property: 'activityDate',
      desc: false
    }
  ]);
  
}

Projector.prototype.initializeDatabase = function()
{
  
//  this.db.removeCollection('actors');
//  this.db.removeCollection('funds');
//  this.db.removeCollection('settings');
  this.db.addCollection('actors');
  this.db.addCollection('funds');
  var pm = this.db.addCollection('settings');
    
  var settings = {
    key: 'ProjectorSettings',
    val: {
      universeName: 'default',
      inceptionDate: (new Date()).getTime(),
      pastWindow: 4, //The number of months in the past to render by default
      futureWindow: 6 // The number of months in the future to render by default
    }
  }
    
  pm.insert(settings);
}

Projector.prototype.addFund = function(options) 
{
	var fund = new Fund(options);
    
	this.db.getCollection("funds").insert(fund);
    
    return fund;
}

Projector.prototype.addActor = function(options)
{
	var actor = new Actor(options);

	this.db.getCollection("actors").insert(actor);
    
    return actor;
}

Projector.prototype.activitiesByFund = function(fundId)
{
    var result = this.activities.chain("DoesAffectFund", { fundId: fundId }).data();

    return result;
}

Projector.prototype.renderUniverse = function(start, end) {
  var idx;
  var actorColl = this.db.getCollection("actors");
  var actors = actorColl.find();
  var aa = [];
  
  this.activities.clear();
  
  // For each actor, project its activities for time window
  for(idx=0; idx<actors.length; idx++) {
    if (!actors.isDisabled) {
  		aa = actors[idx].projectActivities(start, end);
  		this.activities.insert(aa);
    }
  }

  // Historical Balances not implemented
  //foreach (Fund f in Funds)
  //{
  //  Activities.AddRange(f.ProjectActivities(StartDate, EndDate));
  //}

  // Volatile Actors were used for forcing 0 amount transactions
  // on first day, today, and last day to force plot points for those days
  //foreach (Actor actor in VolatileActors)
  //{
  //  Activities.AddRange(actor.ProjectActivities(StartDate, EndDate));
  //}

  // Sequence activities chronologically
  var sortedActivities = this.activities.chain().simplesort('activityDate').data();

  // Execute activities to generate volatile transactions and balances
  for(idx=0; idx<sortedActivities.length; idx++) {
  	sortedActivities[idx].execute();
  }
}

/**
 * Balance
 */
 
// consolidating Balance and Tranction classes
// transactions inherited balance and added 'affectingActor' reference
function Balance(amount, balanceDate, description, affectingActor) {
  this.amount = amount;
  this.balanceDate = balanceDate;
  this.description = description;
  this.affectingActor = affectingActor;
}

Balance.prototype.toString = function() {
	return this.balanceDate + ';' + this.amount + ';' + this.description;
}

/**
 * Fund
 */

function Fund(options) {
  options = options || {};
    
  this.inceptionBalance = options.inceptionBalance || 0.0;
  this.inceptionDate = options.inceptionDate;
  this.name = options.name;
  this.fundClass = options.fundClass;
  this.isBenchmark = options.isBenchmark || false;

  this.equityOffset = options.equityOffset || 0.0;
  this.isHidden = options.isHidden || false;
  this.historicalBalances = options.historicalBalances || [];

	// volatile, not saved
  this.interimBalance = new Balance(this.inceptionBalance, this.inceptionDate, 'inception', null);
  this.volatileBalances = [];
  this.volatileTransactions = [];
}

// can't use serializereplacer as this is nested serialization and replacer
// is controlled at top level of serialization (loki db),
// which knows nothing of our Fund class structure).
Fund.prototype.toJSON = function() 
{
  // to avoid serialization of volatileBalances and volatileTransactions,
  // we will clone our fund and leave those properties empty [] (their default)
  var clone = new Fund({
    inceptionBalance: this.inceptionBalance,
    inceptionDate: this.inceptionDate,
    name: this.name,
    fundClass: this.fundClass,
    isBenchmark: this.isBenchmark,
    equityOffset : this.equityOffset,
    isHidden : this.isHidden,
    historicalBalances : this.historicalBalances
  })
    
  // need loki id to be same as well as meta
  clone.$loki = this.$loki;
  clone.meta = this.meta;
    
  return clone;
}

Fund.prototype.projectActivities = function(startDate, endDate) 
{
}

Fund.prototype.postVolatile = function(amount, postDate, name, affectingActor)
{
  // round amount to 2 decimals
  // amount = decimal.Round(amount, 2);
  var postAmount = amount;
  if (this.fundClass == FundClassEnum.Debt || this.fundClass == FundClassEnum.DebtEquity) 
  {
    postAmount = postAmount * -1;
  }
    
  var trans = new Balance(postAmount, postDate, name, affectingActor);
    
  // VolatileTransactions.Add(trans);
  this.volatileTransactions.push(trans);
    
  // Make a copy so underlying balance reference isn't affected
  var bal = new Balance(this.interimBalance.amount + trans.amount, postDate, name, affectingActor);
  this.interimBalance = bal;
    
  // VolatileBalances.Add(bal);
  this.volatileBalances.push(bal);
    
  return bal;
}

Fund.prototype.resetVolatile = function()
{
  this.volatileBalances = [];
  this.volatileTransactions = [];
  this.interimBalance = new Balance(this.inceptionBalance, this.inceptionDate, 'inception', null);
}

/**
 * Actor
 */

function Actor(options) {
  options = options || {};
    
  this.name = options.name;
  this.fundPrimary = options.fundPrimary;
  this.fundSecondary = options.fundSecondary; // optional feeder fund
  this.periodicity = options.periodicity;
  this.periodicityUnits = options.periodicityUnits;
  this.triggerDateInitial = options.triggerDateInitial;
  this.triggerAmount = options.triggerAmount;
  this.triggerDateEnd = options.triggerDateEnd || MAX_DATE;
  this.isLoanPayment = options.isLoanPayment || false;
  this.interestRate = options.interestRate;
  this.isCompoundInterestAccrual = options.isCompoundInterestAccrual || false;
  this.compoundInterestRate = options.compoundInterestRate;
  this.loanDurationYears = options.loanDurationYears;
  this.isDisabled = options.isDisabled || false;

  // use serializeReplacer to null out?  this was not being serialized
  this.nextTriggerDate = null;
}

Actor.prototype.synchronize = function(syncDate) {
  this.nextTriggerDate = this.triggerDateInitial;

  if (this.triggerDateInitial >= syncDate) return;

  while (this.nextTriggerDate <= syncDate) {
    switch(this.periodicity) {
      case ActorPeriodicityEnum.Daily : 
        this.nextTriggerDate = 
          AddDate(
            this.nextTriggerDate, 
            this.periodicityUnits, 
            'days');
          break;
      case ActorPeriodicityEnum.Weekly : 
        this.nextTriggerDate = 
          AddDate(
            this.nextTriggerDate, 
            this.periodicityUnits, 
            'weeks');
          break;
      case ActorPeriodicityEnum.Monthly : 
        this.nextTriggerDate = 
          AddDate(
            this.nextTriggerDate, 
            this.periodicityUnits, 
            'months');
          break;
      case ActorPeriodicityEnum.Yearly : 
        this.nextTriggerDate = 
          AddDate(
            this.nextTriggerDate, 
            this.periodicityUnits, 
            'years');
          break;
      case ActorPeriodicityEnum.OnceOnly : 
        this.nextTriggerDate = MAX_DATE;
        break;
    }
        
    // If next trigger occurs after the Actor range ends, 
    // flag actor termination with NextTriggerDate as maxvalue
    if (this.triggerDateEnd != MAX_DATE && this.triggerDateEnd < this.nextTriggerDate) {
      this.nextTriggerDate = MAX_DATE;
    }
  }
}

Actor.prototype.projectActivities = function(startDate, endDate) {
  this.synchronize(startDate);

  var activities = [];

  if (this.nextTriggerDate > endDate) return activities;

  while (this.nextTriggerDate <= endDate) {
    // next trigger fires within projection range, so add
    activities.push(new Activity(this.nextTriggerDate, ActivityTypeEnum.Actor, null, this));

    // progress nextTriggerDate to next trigger date
    switch(this.periodicity) 
    {
      case ActorPeriodicityEnum.Daily: 
        this.nextTriggerDate = 
          AddDate(
            this.nextTriggerDate, 
            this.periodicityUnits, 
            'days');
          break;
      case ActorPeriodicityEnum.Weekly : 
        this.nextTriggerDate = 
          AddDate(
            this.nextTriggerDate, 
            this.periodicityUnits, 
            'weeks');
          break;
      case ActorPeriodicityEnum.Monthly : 
        this.nextTriggerDate = 
          AddDate(
            this.nextTriggerDate, 
            this.periodicityUnits, 
            'months');
          break;
      case ActorPeriodicityEnum.Yearly : 
        this.nextTriggerDate = 
          AddDate(
            this.nextTriggerDate, 
            this.periodicityUnits, 
            'years');
          break;
      case ActorPeriodicityEnum.OnceOnly : 
        this.nextTriggerDate = MAX_DATE;
        break;
      default :
        alertify.log('Unknown actor periodicity');
        break;
    }
        
    // If next trigger occurs after the Trigger Ends, flag actor termination with NextTriggerDate as maxvalue
    if (this.triggerDateEnd != MAX_DATE && this.triggerDateEnd < this.nextTriggerDate) {
      this.nextTriggerDate = MAX_DATE;
    }
  }

  return activities;
}

Actor.prototype.executeActivity = function(activity)
{
  // Lookup fund object, given its id reference property
  var fpr = singletonContinuum.db.getCollection("funds").get(this.fundPrimary);
  var fsr = null;

  if (this.fundSecondary) fsr = singletonContinuum.db.getCollection("funds").get(this.fundSecondary);

  if (fpr.fundClass == FundClassEnum.Debt || fpr.FundClass == FundClassEnum.DebtEquity) 
  {
    if (fpr.interimBalance.amount <= 0.0) {
      activity.renderedBalancePrimary = fpr.interimBalance;
      activity.renderedBalanceSecondary = fsr.interimBalance;
      return;
    }
  }

  // handle loan payment
  if (this.isLoanPayment) 
  {
    // Calculate Monthly Payment - using double type for Math.Pow
    var p = fpr.inceptionBalance;
    var i = this.interestRate / 1200;
    var m = this.loanDurationYears * 12;
    var monthlyPayment = p * (i / (1 - Math.pow( (1 + i), -m) ));

    // If you know the Fund balance on the payment date you can calculate 
    // how much of that is interest... the rest goes to principle

    // Interest Portion = most recent Balance * Annual Interest rate / 12 (assumes monthly payments)
    // We are expecting InterimBalance to be kept up to date by our 
    //    chronological calls to PostVolatileTransaction
    var actualInterestRate = this.interestRate / 100;
    var interestPaid = fpr.interimBalance.amount * actualInterestRate / 12;
    var principlePaid = monthlyPayment - interestPaid;

    // Monthly Payment calculations dont include overhead of escrow, insurance, etc.
    // So the monthly payment calculation was only to calculate the principle
    // We will use Actor TriggerAmount as Monthly Payment

    // Only Posting Portion of Monthly payment added to Principle (Equity)
    activity.renderedBalancePrimary = fpr.postVolatile(principlePaid, activity.activityDate, this.name + " (Principle)", this.$loki);

    // Usually you will need feeder account but benchmark loans might not want to have one
    if (fsr != null)
    {
      // split the pull from feeder fund into principle and interest for later analysis
      fsr.postVolatile(-(this.triggerAmount - principlePaid), activity.activityDate, this.name + " (Overhead)", this.$loki);
      activity.renderedBalanceSecondary = fsr.postVolatile(-principlePaid, activity.activityDate, this.name + " (Principle)", this.$loki);
    }

    return;
  }

  // handle interest accrual
  if (this.isCompoundInterestAccrual)
  {
    if (this.periodicity != ActorPeriodicityEnum.Monthly) {
      console.log("An interest accrual actor " + this.name + " is not set to monthly periodicity!");    
    }
    else {
      var calculatedRate = this.periodicityUnits / 12.0 * this.compoundInterestRate / 100.0;
      var interestAccrued = fpr.interimBalance.amount * calculatedRate;

      activity.renderedBalancePrimary = fpr.postVolatile(interestAccrued, activity.activityDate, this.name, this.$loki);
    }

    return;
  }

  // all other actors post only trigger amounts
  activity.renderedBalancePrimary = fpr.postVolatile(this.triggerAmount, activity.activityDate, this.name, this.$loki);

  // if feeder fund specifies, remove trigger amount from that
  if (this.fundSecondary != null) 
  {
    fsr = singletonContinuum.db.getCollection("funds").get(this.fundSecondary);
    activity.renderedBalanceSecondary = fsr.postVolatile(this.triggerAmount * -1, activity.activityDate, this.name, this.$loki);
  }
}

/**
 * Activity
 */
function Activity(activityDate, activityType, affectingFund, affectingActor, balancePrimary) {
  this.activityDate = activityDate;
  this.activityType = activityType;
  this.affectingFund = affectingFund;
  this.affectingActor = affectingActor;
  this.renderedBalancePrimary = balancePrimary;
  this.renderedBalanceSecondary = null;
}

Activity.prototype.execute = function()
{
  switch(this.activityType)
  {
    case ActivityTypeEnum.Actor: 
      this.affectingActor.executeActivity(this); 
      break;
    case ActivitiyTypeEnum.FundReconcile: 
      this.affectingFund.executeActivity(this); 
      break;
    default :
      throw "Unknown Activity Type";
      break;
  }
}


Activity.prototype.doesAffectFund = function(fundId)
{
  if (this.activityType == ActivityTypeEnum.FundReconcile)
  {
    if (this.affectingFund == fundId) return true;
  }

  if (this.activityType == ActivityTypeEnum.Actor)
  {
    if (this.affectingActor.fundPrimary == fundId) return true;
    if (this.affectingActor.fundSecondary == fundId) return true;
  }

  return false;
}


return Projector;
}());

// misc helper routines
function addTestData() {
  // set up funds
  var fundSavings = continuum.addFund({
    inceptionBalance: 1000, 
    inceptionDate: (new Date()).getTime(), 
    name: "savings", 
    fundClass: continuum.enums.FundClass.Savings
  });

  var fundChecking = continuum.addFund({
    inceptionBalance: 500, 
    inceptionDate: (new Date()).getTime(), 
    name: "checking", 
    fundClass: continuum.enums.FundClass.Spending,
    isHidden: false
  });

  var fundMortgage = continuum.addFund({
    inceptionBalance: 100000, 
    inceptionDate: (new Date()).getTime(), 
    name: "mortgage", 
    fundClass: continuum.enums.FundClass.DebtEquity
  });

  var fundAutoLoan = continuum.addFund({
    inceptionBalance: 20000, 
    inceptionDate: (new Date()).getTime(), 
    name: "auto loan", 
    fundClass: continuum.enums.FundClass.Debt
  });

  // set up actors
  var actorSavingsPlan = continuum.addActor({
    name: 'saving plan', 
    fundPrimary: fundSavings.$loki, 
    periodicity: continuum.enums.ActorPeriodicity.Monthly, 
    periodicityUnits: 1, 
    triggerDateInitial: (new Date()).getTime(), 
    triggerAmount: 250
  });

  var actorSavingsAccrual = continuum.addActor({
    name: 'savings accrue',
    fundPrimary: fundSavings.$loki,
    periodicity: continuum.enums.ActorPeriodicity.Monthly,
    periodicityUnits: 1,
    triggerDateInitial: (new Date()).getTime(),
    compoundInterestRate: 3,
    isCompoundInterestAccrual : true
  });

  var actorPaycheck = continuum.addActor({
    name: 'paycheck', 
    fundPrimary: fundChecking.$loki, 
    periodicity: continuum.enums.ActorPeriodicity.Weekly, 
    periodicityUnits: 1, 
    triggerDateInitial: (new Date()).getTime(), 
    triggerAmount: 1000
  });

  var actorMortgagePayment = continuum.addActor({
    name: 'mortgage payment', 
    fundPrimary: fundMortgage.$loki, 	// apply payment to
    fundSecondary: fundChecking.$loki, // feeder fund
    periodicity: continuum.enums.ActorPeriodicity.Monthly, 
    periodicityUnits: 1, 
    triggerDateInitial: (new Date()).getTime(), 
    triggerAmount: 800,
    isLoanPayment: true,
    loanDurationYears: 30,
    interestRate: 3.0
  });

  var actorCarPayment = continuum.addActor({
    name: 'auto loan', 
    fundPrimary: fundAutoLoan.$loki, 
    fundSecondary: fundChecking.$loki, // feeder fund is checking
    periodicity: continuum.enums.ActorPeriodicity.Monthly, 
    periodicityUnits: 1, 
    triggerDateInitial: (new Date()).getTime(),
    triggerDateEnd: continuum.AddDate((new Date()).getTime(), 5, "years"),
    triggerAmount: 300,
    isLoanPayment: true,
    loanDurationYears: 5,
    interestRate: 4.0
  });
}

function runProjection() 
{
  var funds = continuum.db.getCollection("funds");

  funds.find().forEach(function(fund)
  {
    fund.resetVolatile();
  });

  var now = (new Date()).getTime();

	var start = continuum.AddDate(now, -2, "months"); 
	var end = continuum.AddDate(now, 4, "months");
  if (end <= start) 
  {
    end = continuum.AddDate(start, 1, "months");
  }
  
  console.log("-----------------------------");
  console.log("Continuum running projection:");
  console.log("Window Start : " + (new Date(start)));
  console.log("Window End : " + (new Date(end)));
  console.log("-----------------------------");
  
  continuum.renderUniverse(continuum.MIN_DATE, end);

  funds.find().forEach(function(fund)
  {
    if (fund.volatileBalances.length > 0) {
      console.log("Fund (" + fund.name + ") : ");
      console.log("  Final Balance : " + fund.volatileBalances[fund.volatileBalances.length-1].amount);
      console.log("  Volatile Transaction Count : " + fund.volatileTransactions.length);
    }
    else {
      console.log("Fund (" + fund.name + ") No Activity, Inception Balance : " + fund.inceptionBalance);
    }
  });

  console.log();
  console.log("-----------------------------");
  console.log("Projection Complete");
}

function dbLoaderCallback()
{
  if (continuum.db.collections.length == 0) 
  {
    continuum.initializeDatabase();
    addTestData();
  }

  runProjection();

  // Let database load or initialize above and then change 'checking'
  // fund's inception balance by increasing by 10.
  // That change should be autosaved after 4 or so seconds
  // and affect the next run.
  setTimeout(function() {
    console.log();
    var checkingFund = continuum.db.getCollection("funds").findOne({'name':'checking'});
    console.log("old inceptionBalance: " + checkingFund.inceptionBalance);
    checkingFund.inceptionBalance += 10;
    console.log("new inceptionBalance: " + checkingFund.inceptionBalance);
    continuum.db.getCollection("funds").update(checkingFund);
    console.log("");
    console.log("activities for checking: ");
    logActivities(continuum.activitiesByFund(checkingFund.$loki));
    console.log("");
    console.log("due to autosave timer, you may need to ctrl-c to quit");
    console.log("wait 5 seconds before quitting to increase checking by 10 on next run");
  }, 500);
}

function logActivities(activities) {
  var fsdesc;
  
  activities.forEach(function(obj) {
    fsdesc = obj.affectingActor.fundSecondary?
        (" | balance ( " + continuum.db.getCollection("funds").get(obj.affectingActor.fundSecondary).name  + ") : " + obj.renderedBalanceSecondary.amount) : "";

    console.log("description : " + obj.affectingActor.name + 
      " | amount : " + obj.affectingActor.triggerAmount +
      " | balance ( " + continuum.db.getCollection("funds").get(obj.affectingActor.fundPrimary).name  + ") : " + obj.renderedBalancePrimary.amount +
      fsdesc
      );
  });
}

var continuum = new LokiContinuum("LokiContinuum.db", {
        autoload: true,
        autoloadCallback : dbLoaderCallback,
        autosave: true, 
        autosaveInterval: 4000
});


