// Unminified version of the Enhanced JSON-LD Extractor bookmarklet
(function() {
    var playlistUrl = null;
    var searchDepth = 0;

    function searchDocument(doc, level) {
        searchDepth = Math.max(searchDepth, level);
        console.log('Searching document at level:', level);

        // Find JSON-LD scripts
        var jsonScripts = doc.querySelectorAll('script[type="application/ld+json"]');
        console.log('Level', level, '- Found JSON-LD scripts:', jsonScripts.length);
        for (var j = 0; j < jsonScripts.length; j++) {
            try {
                var jsonData = JSON.parse(jsonScripts[j].textContent);
                console.log('Level', level, '- Parsed JSON-LD:', jsonData);
                if (jsonData.contentUrl && jsonData.contentUrl.includes('.m3u8')) {
                    playlistUrl = jsonData.contentUrl;
                    console.log('Level', level, '- Found M3U8 in JSON-LD contentUrl:', playlistUrl);
                    return playlistUrl;
                }
            } catch (e) {
                console.log('Level', level, '- Error parsing JSON-LD:', e.message);
            }
        }

        // Find <video> elements
        var videos = doc.querySelectorAll('video');
        console.log('Level', level, '- Found videos:', videos.length);
        for (var v = 0; v < videos.length; v++) {
            var video = videos[v];
            console.log('Level', level, '- Checking video:', video.id);
            var sources = video.querySelectorAll('source[type="application/x-mpegURL"]');
            console.log('Level', level, '- Found M3U8 sources:', sources.length);
            for (var s = 0; s < sources.length; s++) {
                if (sources[s].src && sources[s].src.includes('.m3u8')) {
                    playlistUrl = sources[s].src.split('?')[0];
                    console.log('Level', level, '- Found M3U8:', playlistUrl);
                    return playlistUrl;
                }
            }
        }

        // Search iframes recursively (up to 3 levels)
        if (level < 3) {
            var iframes = doc.querySelectorAll('iframe');
            console.log('Level', level, '- Found iframes:', iframes.length);
            for (var i = 0; i < iframes.length; i++) {
                console.log('Level', level, '- Checking iframe:', iframes[i].src);
                try {
                    var iframeDoc = iframes[i].contentDocument || iframes[i].contentWindow.document;
                    if (iframeDoc) {
                        console.log('Level', level, '- Accessing iframe document...');
                        var result = searchDocument(iframeDoc, level + 1);
                        if (result) return result;
                    }
                } catch (e) {
                    console.log('Level', level, '- Cross-origin iframe:', e.message);
                }
            }
        }
        return null;
    }

    try {
        console.log('Starting JSON-LD extraction with enhanced folder structure...');
        playlistUrl = searchDocument(document, 0);
        if (!playlistUrl) {
            console.log('No M3U8 found after searching', searchDepth + 1, 'levels');
            alert('No M3U8 video found - searched ' + (searchDepth + 1) + ' iframe levels');
            return;
        }

        var mainDoc = window.top.document;
        console.log('== USING PRECISE CSS SELECTORS ==');
        var mainTitle = 'Video';
        var titleSelectors = [
            'svg g g g g text[font-size="24px"]',
            'svg text[font-size="24px"]',
            'text[font-size="24"]'
        ];
        for (var i = 0; i < titleSelectors.length; i++) {
            var titleEl = mainDoc.querySelector(titleSelectors[i]);
            if (titleEl && titleEl.textContent && titleEl.textContent.trim().length > 0) {
                mainTitle = titleEl.textContent.trim();
                console.log('Found main title using selector', i, ':', mainTitle);
                break;
            }
        }

        var subtitle = '';
        var subtitleSelectors = [
            'svg g g g g text[font-size="19px"]',
            'svg text[font-size="19px"]',
            'text[font-size="19"]'
        ];
        for (var j = 0; j < subtitleSelectors.length; j++) {
            var subtitleEl = mainDoc.querySelector(subtitleSelectors[j]);
            if (subtitleEl && subtitleEl.textContent && subtitleEl.textContent.trim().length > 0) {
                subtitle = subtitleEl.textContent.trim();
                console.log('Found subtitle using selector', j, ':', subtitle);
                break;
            }
        }

        var pageNum = '';
        console.log('== SEARCHING FOR PAGINATION ==');
        var pageSelectors = [
            'div[data-acc-text*="Page"][data-acc-text*="of"]',
            'div.slide-object[data-acc-text*="Page"]',
            'div[data-display-name="SlideObject"][data-acc-text*="Page"]',
            'span[data-original-size="16px"]',
            'p span',
            'span'
        ];
        for (var k = 0; k < pageSelectors.length; k++) {
            var pageElements = mainDoc.querySelectorAll(pageSelectors[k]);
            console.log('Trying selector', k, ':', pageSelectors[k], '- found', pageElements.length, 'elements');
            for (var p = 0; p < pageElements.length; p++) {
                var pageEl = pageElements[p];
                var pageText = pageEl.textContent ? pageEl.textContent.trim() : '';
                var accText = pageEl.getAttribute('data-acc-text') || '';
                console.log('Checking element - textContent:', pageText, '- data-acc-text:', accText);
                var textToCheck = accText || pageText;
                console.log('Text to check for page pattern:', JSON.stringify(textToCheck));
                var pagePattern = 'Page ';
                if (textToCheck.indexOf(pagePattern) !== -1 && textToCheck.indexOf('of') !== -1) {
                    var pageStart = textToCheck.indexOf(pagePattern) + pagePattern.length;
                    var pageEnd = textToCheck.indexOf(' of');
                    var pageNumber = textToCheck.substring(pageStart, pageEnd);
                    pageNum = ' page ' + pageNumber;
                    console.log('EXTRACTED PAGE NUMBER:', pageNumber);
                    break;
                }
            }
            if (pageNum) break;
        }
        if (!pageNum) {
            pageNum = ' page ' + Math.floor(Math.random() * 10 + 1);
            console.log('NO PAGE FOUND - USING RANDOM:', pageNum);
        }

        // Sanitize function (no regex for NBSP)
        function sanitize(str) {
            var out = '';
            for (var i = 0; i < str.length; i++) {
                var ch = str.charCodeAt(i);
                if (ch === 160) out += '-';
                else out += str.charAt(i);
            }
            out = out.replace(/:/g, '-');
            out = out.replace(/[<>"|?*\\/]/g, '-');
            out = out.replace(/\s+/g, '');
            return out.trim();
        }

        var cleanTitle = sanitize(mainTitle);
        var cleanSub = sanitize(subtitle);
        console.log('Sanitized title:', cleanTitle);
        console.log('Sanitized subtitle:', cleanSub);

        var filename;
        if (cleanSub) {
            filename = cleanTitle + '\\' + cleanSub + '\\' + cleanSub + pageNum + '.mp4';
        } else {
            filename = cleanTitle + pageNum + '.mp4';
        }
        console.log('Generated filename:', filename);

        // Use normal spaces in command
        var command = 'dlm3u8.bat "' + playlistUrl + '" "' + filename + '"';
        // Replace NBSP in command (no regex)
        var fixedCommand = '';
        for (var i = 0; i < command.length; i++) {
            fixedCommand += (command.charCodeAt(i) === 160) ? '-' : command.charAt(i);
        }
        console.log('Final command:', fixedCommand);
        navigator.clipboard.writeText(fixedCommand).then(function() {
            alert('Command copied to clipboard:\n\n' + fixedCommand);
        }).catch(function() {
            prompt('Copy this command:', fixedCommand);
        });
    } catch (e) {
        console.log('Error:', e);
        alert('Error: ' + e.message + ' - check console for details');
    }
})();
