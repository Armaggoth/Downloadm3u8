// Video Info Extractor Bookmarklet (Readable Version)
// This creates nested folders: MainTitle > ModuleTitle > video files

javascript:(function(){
    // Utility function to sanitize filenames (PowerShell compatible - removes spaces)
    function sanitizeFilename(filename) {
        return filename
            .replace(/[<>:"/\\|?*]/g, '-')
            .replace(/\s+/g, '')
            .trim();
    }

    // === EXTRACT MAIN COURSE TITLE ===
    var mainTitle = "Optimizely Content Cloud Development Fundamentals for CMS 12"; // Default
    
    // Method 1: Look for 24px SVG text elements (most reliable - main title)
    var svgMainTitleElement = document.querySelector('text[font-size="24px"] tspan');
    if (svgMainTitleElement && svgMainTitleElement.textContent.includes('Optimizely')) {
        var svgText = svgMainTitleElement.textContent.replace(/\s+/g, ' ').trim();
        console.log('Found SVG main title (24px):', svgText);
        mainTitle = svgText;
    }
    
    // === EXTRACT SUBTITLE ===
    var moduleTitle = "Introduction"; // Default
    
    // Method 1: Look for 19px SVG text elements (most reliable - subtitle)
    var svgSubtitleElement = document.querySelector('text[font-size="19px"] tspan');
    if (svgSubtitleElement) {
        var subtitleText = svgSubtitleElement.textContent.replace(/\s+/g, ' ').trim();
        console.log('Found SVG subtitle (19px):', subtitleText);
        moduleTitle = subtitleText;
    }
    
    // Method 2: Fallback to accessibility text parsing
    if (!svgSubtitleElement) {
        var titleElement = document.querySelector('[data-acc-text*="Optimizely Content Cloud Development Fundamentals"]');
        if (titleElement) {
            var fullTitle = titleElement.getAttribute('data-acc-text');
            console.log('Fallback: Found accessibility text:', fullTitle);
            
            // Extract subtitle by removing the main title
            if (fullTitle.includes(mainTitle)) {
                var subtitle = fullTitle.replace(mainTitle, '').trim();
                
                if (subtitle) {
                    moduleTitle = subtitle;
                }
            } else {
                // Pattern matching fallback
                var moduleMatch = fullTitle.match(/^(.*?)\s+(Module\s+[A-Z]:.+|Introduction|Overview|Summary)$/i);
                if (moduleMatch) {
                    mainTitle = moduleMatch[1].trim();
                    moduleTitle = moduleMatch[2].trim();
                }
            }
        }
    }
    
    // Method 3: Additional SVG search for edge cases
    if (moduleTitle === "Introduction") {
        var allTspans = document.querySelectorAll('tspan');
        for (var t = 0; t < allTspans.length; t++) {
            var tspanText = allTspans[t].textContent.trim();
            if (tspanText.match(/^Module\s+[A-Z]:|^Introduction$|^Overview$|^Summary$/)) {
                moduleTitle = tspanText;
                console.log('Found subtitle in general SVG search:', moduleTitle);
                break;
            }
        }
    }

    // === EXTRACT PAGE NUMBER ===
    var pageElement = document.querySelector('[data-acc-text*="Page "]');
    var pageNumber = "1"; // Default
    
    if (pageElement) {
        var pageText = pageElement.getAttribute('data-acc-text');
        var pageMatch = pageText.match(/Page\s+(\d+)/);
        if (pageMatch) {
            pageNumber = pageMatch[1];
        }
    }

    // === EXTRACT M3U8 PLAYLIST URL ===
    var playlistUrl = "";
    
    // Method 1: Check iframes for video content
    var iframes = document.querySelectorAll('iframe');
    for (var i = 0; i < iframes.length; i++) {
        try {
            var iframeDoc = iframes[i].contentDocument || iframes[i].contentWindow.document;
            
            // Check scripts in iframe
            var scripts = iframeDoc.querySelectorAll('script');
            for (var j = 0; j < scripts.length; j++) {
                var scriptText = scripts[j].textContent;
                var m3u8Match = scriptText.match(/https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/);
                if (m3u8Match) {
                    playlistUrl = m3u8Match[0];
                    break;
                }
            }
            if (playlistUrl) break;
            
            // Check video elements in iframe
            var videos = iframeDoc.querySelectorAll('video');
            for (var k = 0; k < videos.length; k++) {
                var src = videos[k].src;
                if (src && src.includes('.m3u8')) {
                    playlistUrl = src;
                    break;
                }
            }
            if (playlistUrl) break;
        } catch (e) {
            // Cross-origin iframe - skip
        }
    }

    // Method 2: Check main document scripts for Wistia URLs
    if (!playlistUrl) {
        var scripts = document.querySelectorAll('script');
        for (var l = 0; l < scripts.length; l++) {
            var scriptText = scripts[l].textContent;
            if (scriptText.includes('wistia.com') || scriptText.includes('fast.wistia.com')) {
                var m3u8Match = scriptText.match(/https?:\/\/fast\.wistia\.com\/embed\/medias\/[a-zA-Z0-9]+\.m3u8/);
                if (m3u8Match) {
                    playlistUrl = m3u8Match[0];
                    break;
                }
            }
        }
    }

    // Method 3: Enhanced search in page source and network requests
    if (!playlistUrl) {
        // Check all script tags more thoroughly
        var allScripts = document.querySelectorAll('script');
        for (var s = 0; s < allScripts.length; s++) {
            var scriptContent = allScripts[s].textContent || allScripts[s].innerHTML;
            
            // Look for various M3U8 patterns
            var m3u8Patterns = [
                /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/g,
                /https?:\/\/embed-ssl\.wistia\.com\/deliveries\/[^"'\s]+\.m3u8/g,
                /https?:\/\/fast\.wistia\.com\/embed\/medias\/[^"'\s]+\.m3u8/g,
                /"(https?:\/\/[^"]+\.m3u8[^"]*)"/g,
                /'(https?:\/\/[^']+\.m3u8[^']*)'/g
            ];
            
            for (var p = 0; p < m3u8Patterns.length; p++) {
                var matches = scriptContent.match(m3u8Patterns[p]);
                if (matches && matches.length > 0) {
                    // Take the first valid-looking URL
                    for (var m = 0; m < matches.length; m++) {
                        var candidate = matches[m].replace(/['"]/g, '');
                        if (candidate.includes('.m3u8') && !candidate.includes('optimizely.m3u8')) {
                            playlistUrl = candidate;
                            console.log('Found M3U8 in script content:', playlistUrl);
                            break;
                        }
                    }
                    if (playlistUrl) break;
                }
            }
            if (playlistUrl) break;
        }
    }
    
    // Method 4: Check meta tags and data attributes
    if (!playlistUrl) {
        var metaTags = document.querySelectorAll('meta[content*=".m3u8"], [data-*="*.m3u8"], [src*=".m3u8"]');
        for (var mt = 0; mt < metaTags.length; mt++) {
            var content = metaTags[mt].getAttribute('content') || metaTags[mt].getAttribute('src') || metaTags[mt].getAttribute('data-src');
            if (content && content.includes('.m3u8')) {
                playlistUrl = content;
                console.log('Found M3U8 in meta/data attributes:', playlistUrl);
                break;
            }
        }
    }

    // Method 5: Last resort - check if page has video content before generating fallback
    if (!playlistUrl) {
        // Look for video-related elements to confirm this page actually has video
        var hasVideoElements = document.querySelectorAll('video, iframe[src*="wistia"], iframe[src*="vimeo"], iframe[src*="youtube"], .wistia_embed, [class*="video"], [id*="video"]').length > 0;
        
        if (hasVideoElements) {
            // Only then try URL-based fallback
            var currentUrl = window.location.href;
            var videoIdMatch = currentUrl.match(/([a-zA-Z0-9]{10,})/);
            if (videoIdMatch) {
                var candidateUrl = "https://fast.wistia.com/embed/medias/" + videoIdMatch[1] + ".m3u8";
                console.warn('No M3U8 found, using URL-based fallback:', candidateUrl);
                playlistUrl = candidateUrl;
            }
        }
    }

    // Final validation - don't proceed without a real playlist
    if (!playlistUrl) {
        alert("❌ No video playlist found on this page!\n\nThis page doesn't appear to contain a video. Please navigate to a page with video content and try again.");
        return null;
    }

    // Clean up the playlist URL
    playlistUrl = playlistUrl.replace(/["']/g, '').split(/[?#]/)[0];

    // === CREATE NESTED FOLDER STRUCTURE ===
    var sanitizedMainTitle = sanitizeFilename(mainTitle);
    var sanitizedModuleTitle = sanitizeFilename(moduleTitle);
    
    // Two-level nested directory: MainTitle\ModuleTitle
    var directory = sanitizedMainTitle + "\\" + sanitizedModuleTitle;
    
    // Filename: ModuleTitle page X.mp4
    var filename = sanitizedModuleTitle + " page " + pageNumber + ".mp4";
    
    // Full path: MainTitle\ModuleTitle\ModuleTitle page X.mp4
    var fullPath = directory + "\\" + filename;
    
    // Final download command
    var command = 'dlm3u8.bat "' + playlistUrl + '" "' + fullPath + '"';

    // === RESULTS ===
    var results = {
        mainTitle: mainTitle,
        moduleTitle: moduleTitle,
        pageNumber: pageNumber,
        playlistUrl: playlistUrl,
        directory: directory,
        filename: filename,
        fullPath: fullPath,
        command: command
    };

    // Show results to user
    alert("Video Info Extracted!\n\nCommand: " + command + "\n\nCheck console for full details.");
    
    // Log detailed results
    console.log('=== Video Extract Results ===');
    console.log('Main Title:', results.mainTitle);
    console.log('Module Title:', results.moduleTitle);
    console.log('Page Number:', results.pageNumber);
    console.log('Playlist URL:', results.playlistUrl);
    console.log('Directory:', results.directory);
    console.log('Filename:', results.filename);
    console.log('Full Path:', results.fullPath);
    console.log('Command:', results.command);
    console.log('=============================');

    // Copy command to clipboard
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(results.command).then(function() {
            console.log('Command copied to clipboard!');
        }).catch(function(err) {
            console.log('Could not copy to clipboard:', err);
        });
    }

    return results;
})();