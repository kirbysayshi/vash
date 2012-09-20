var
	 vash = require(__dirname + '/../build/vash')
	,express = require('express')
	,app = express();

app.configure(function(){

	vash.config.debug = true;


	app.use(app.router);
	app.use(express.static(__dirname + '/fixtures/public'));
	app.use(express.bodyParser());
	app.set('views', __dirname + '/fixtures/views');
	app.set('view engine', 'vash')

	// allow for .html extension for templates as well as vash
	app.engine('html', vash.__express);
	app.engine('vash', vash.__express); // just because we're running within the Vash repo
})

app.get('/', function(req, res){

	res.render('index.vash', {
		 title: 'Vash Express Test'
		,location: {
			name: 'The House Next to the Chinese Restaurant'
			,hours: [
				 { day: 'M', start: '8:00AM', end: '11:00PM' }
				,{ day: 'T', start: '8:00AM', end: '11:00PM' }
				,{ day: 'W', start: '8:00AM', end: '11:00PM' }
				,{ day: 'TR', start: '8:00AM', end: '11:00PM' }
				,{ day: 'F-S', start: '8:00AM', end: '1:00AM' }
				,{ day: 'SU', start: '11:00AM', end: '7:00PM' }
			]
			,street: '235 Mystreet Ave'
			,city: 'Brooklyn'
			,state: 'NY'
			,zip: '11222'
			,gmapLink: 'http://maps.google.com'
			,menuLink: 'http://google.com'
		}
	})
})

app.listen(3000);
