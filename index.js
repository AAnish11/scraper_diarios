//INFO: bajar de clarin

QuieroPathsSinCaracteresRaros= 1;

OutDir= 'x_out';
RawDir= OutDir+'/raw';

BaseHRef= 'https://www.clarin.com';

Crawler = require('crawler'); //U: bajar html del servidor
Cheerio= require('cheerio'); //U: parsear html, la instala crawler
Sh= require('shelljs'); //U: archivos, directorios, como bash
Fs= require('fs');
fNop= () => {}; //U: para funcs que requieren callback pero no interesa

var crawler = new Crawler({
	maxConnections : 1,
});

Vista={}; //U: url -> si ya la pedimos

function fnamePara(href) { //U: un path estandar para una url
	var r= href.replace(/^https?:\/\//,'').replace(/:\d+/,'');
	return (QuieroPathsSinCaracteresRaros) ?
		r.replace(/([^a-z0-9\.\/])/gi,function (x,c) { return '_'+c.charCodeAt(0).toString(16) })
		: r;
}

function fnameRawPara(href) { //U: para guardar y leer lo que devolvio el server
	return RawDir+'/'+fnamePara(href);
}

function asegurarDir(fname) { //U: crea dirs necesarios para guardar fname si no existen
	var dir= fname.replace(/[^\/]+$/,'');
	Sh.mkdir('-p',dir);	
}

function limpiarTxt(txt) {
	return (limpiarHtml(txt, true)
		.replace(/\<[^>]*\>/g,'')
		.replace(/[\r\n\s]+/,' ')
		.replace(/^\s+/,'')
		.replace(/\s+$/,'')
	);
}

function limpiarHtml(html,wantsText) {
	try {
		var $= Cheerio.load(html||'', {decodeEntities: true, normalizeWhitespace: true});
		$('script').remove();
		$('.newsletter-embeb').remove();
		$('.ad-slot').remove();
		$('.content-new').remove();
		return (wantsText ? $.text() : $.html());
	}
	catch (ex) {
		console.error("limpiarHtml",ex,html);
	}
}


function guardarRaw(res, fname) { //U: guardar tal cual devolvio server (ej. para no pedir mil veces)
	fname= fname || fnameRawPara( res.options.uri );
	asegurarDir(fname);
	Fs.createWriteStream(fname).write(res.body);
}

function leerOBajar(href, cbDespues) { //U: leer si tenemos y sino bajar y guardar UNA url
	if (!Vista[href]) { Vista[href]= 1; 
		Fs.readFile(fnameRawPara(href), 'utf-8', function (err, data) {
			if (err || !data || data.length<10) {
				console.log("leerOBajar BAJANDO",href);
				crawler.queue([{
					uri: href,
					callback: function (err, res, done) {
						if(err){ console.error('ERR',href,err.stack); done()}
						else {
							guardarRaw(res);
							cbDespues(href, res, done);
						}
					}
				}]);
			}
			else {
				console.log("leerOBajar LEIDA",href);
				cbDespues(href, {options: {uri: href}, '$': Cheerio.load(data)}, fNop);
			}
		});
	}
}

function bajarGoogle(q, p) {
	leerOBajar(
		'https://www.google.com/search?q='+q+'&start='+(p*10),
		procesarGoogle
	);
}

function procesarGoogle(href, res, done) {
	var $= res.$;
	var l= $('a')
	l.map( (i,e) => { 
		var notaLink= $(e).attr('href'); 
		var m= (notaLink.match(/q=([^&]+)/)||['','']);
		var i= m[1].indexOf(BaseHRef);
		if (i==0) {
			console.log("GOOGLE LINK",i, m[1], notaLink);
			bajarNota(m[1]);
		}
	});

	var gl= $('.fl').last().attr('href');
	console.log("GOOGLE NEXT",gl);
	if (gl) {
		var q= gl.match(/q=([^&]+)/);
		var s= gl.match(/start=([^&]+)/);
		var s_actual= res.options.uri.match(/start=([^&]+)/);
		if (s_actual< s) {
			bajarGoogle(q[1],s[1]/10);
		}
	}

	done();
}

function bajarTema(tema) { //U: baja las notas de un "tema" (lo que Clarin llama tema)
	leerOBajar(
		BaseHRef+'/tema/'+tema+'.html',
		procesarTema
	);
}

function procesarTema(tema, res, done) {
	var $= res.$;
	var l= $('.item-tag')
	l.map( (i,e) => { 
		var notaLink= $(e).attr('href'); 
		bajarNota(BaseHRef + notaLink);
	});
	done();
}

function bajarNota(href) { //U: baja UNA nota y la limpia
	leerOBajar(
		href,
		procesarNota
	);
}

function procesarNota(href, res, done) {
	var r= {};
	r.href= href;
	r.fecha= ((res.$.html()).match(/publishtime"\s+content="([^T]+)/)||[])[1];
	r.titulo= limpiarTxt( res.$('#title').text() );
	r.bajada= limpiarTxt( res.$('.bajada').text() );
	r.volanta= limpiarTxt( res.$('.volanta').text() );
	r.cuerpo= limpiarTxt( res.$('.body-nota').html() )

	var fname= OutDir+'/data/'+fnamePara(href.replace(/.html?$/i,'')+'.json');
	asegurarDir(fname);
	Fs.writeFileSync(
		fname,	
		JSON.stringify(r,null,1)
	);
	done();
}

//============================================================
bajarTema('boleta-unica');
bajarTema('voto-electronico');

bajarGoogle('site:clarin.com+%22voto+electronico',0);
