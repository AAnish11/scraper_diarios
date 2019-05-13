//INFO: bajar de clarin

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
	return href.replace(/^https?:\/\//,'').replace(/:\d+/,'');
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
				cbDespues(href, {'$': Cheerio.load(data)}, fNop);
			}
		});
	}
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
	r.titulo= limpiarTxt( res.$('#title').text() );
	r.bajada= limpiarTxt( res.$('.bajada').text() );
	r.volanta= limpiarTxt( res.$('.volanta').text() );
	r.cuerpo= limpiarTxt( res.$('.body-nota').html() )

	var fname= OutDir+'/data/'+fnamePara(href);
	asegurarDir(fname);
	Fs.writeFileSync(
		fname,	
		JSON.stringify(r,null,1)
	);
	done();
}

//============================================================
bajarTema('boleta-unica');

leerOBajar('https://www.google.com/search?q=site:clarin.com+%22voto+electronico%22&start=20',fNop);
