// Extracts M3U8 video URL and generates a download command for dlm3u8.bat
(function () {
    let m3u8Url = null;
    let maxIframeDepth = 0;

    // Recursively search for M3U8 URL in document and iframes
    function findM3U8(doc, depth) {
        maxIframeDepth = Math.max(maxIframeDepth, depth);

        // Check for JSON-LD script tags
        const jsonScripts = doc.querySelectorAll('script[type="application/ld+json"]');
        for (let script of jsonScripts) {
            try {
                const json = JSON.parse(script.textContent);
                if (json.contentUrl && json.contentUrl.includes('.m3u8')) {
                    m3u8Url = json.contentUrl;
                    return m3u8Url;
                }
            } catch { }
        }

        // Check for video sources
        const videos = doc.querySelectorAll('video');
        for (let video of videos) {
            const sources = video.querySelectorAll('source[type="application/x-mpegURL"]');
            for (let source of sources) {
                if (source.src && source.src.includes('.m3u8')) {
                    m3u8Url = source.src.split('?')[0];
                    return m3u8Url;
                }
            }
        }

        // Recursively check iframes (up to 3 levels)
        if (depth < 3) {
            const iframes = doc.querySelectorAll('iframe');
            for (let iframe of iframes) {
                try {
                    const frameDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (frameDoc) {
                        const found = findM3U8(frameDoc, depth + 1);
                        if (found) return found;
                    }
                } catch { }
            }
        }
        return null;
    }

    try {
        m3u8Url = findM3U8(document, 0);
        if (!m3u8Url) {
            alert(`No M3U8 video found - searched ${maxIframeDepth + 1} iframe levels`);
            return;
        }

        // Extract video and slide titles from top document
        const topDoc = window.top.document;
        let videoTitle = "Video";
        const videoTitleSelectors = [
            'svg g g g g text[font-size="24px"]',
            'svg text[font-size="24px"]',
            'text[font-size="24"]'
        ];
        for (let sel of videoTitleSelectors) {
            const el = topDoc.querySelector(sel);
            if (el && el.textContent && el.textContent.trim().length > 0) {
                videoTitle = el.textContent.trim();
                break;
            }
        }

        let slideTitle = "";
        const slideTitleSelectors = [
            'svg g g g g text[font-size="19px"]',
            'svg text[font-size="19px"]',
            'text[font-size="19"]'
        ];
        for (let sel of slideTitleSelectors) {
            const el = topDoc.querySelector(sel);
            if (el && el.textContent && el.textContent.trim().length > 0) {
                slideTitle = el.textContent.trim();
                break;
            }
        }

        // Extract page number
        let pageSuffix = "";
        const pageSelectors = [
            'div[data-acc-text*="Page"][data-acc-text*="of"]',
            'div.slide-object[data-acc-text*="Page"]',
            'div[data-display-name="SlideObject"][data-acc-text*="Page"]',
            'span[data-original-size="16px"]',
            'p span',
            'span'
        ];
        for (let sel of pageSelectors) {
            const els = topDoc.querySelectorAll(sel);
            for (let el of els) {
                const text = el.textContent ? el.textContent.trim() : "";
                const accText = el.getAttribute("data-acc-text") || "";
                const value = accText || text;
                const pagePrefix = "Page ";
                if (value.indexOf(pagePrefix) !== -1 && value.indexOf("of") !== -1) {
                    const start = value.indexOf(pagePrefix) + pagePrefix.length;
                    const end = value.indexOf(" of");
                    let pageNum = value.substring(start, end);
                    if (pageNum.length === 1) pageNum = "0" + pageNum;
                    pageSuffix = "-page-" + pageNum;
                    break;
                }
            }
            if (pageSuffix) break;
        }
        if (!pageSuffix) {
            pageSuffix = "-page-" + Math.floor(Math.random() * 10 + 1);
        }

        // Sanitize file/folder names
        function sanitize(str) {
            let result = "";
            for (let i = 0; i < str.length; i++) {
                result += str.charCodeAt(i) === 160 ? "-" : str.charAt(i);
            }
            result = result.replace(/:/g, "-")
                .replace(/[<>\"|?*\\\\/]/g, "-")
                .replace(/\\s+/g, "");
            return result.trim();
        }

        const safeVideoTitle = sanitize(videoTitle);
        const safeSlideTitle = sanitize(slideTitle);
        let outputPath;
        if (safeSlideTitle) {
            outputPath = `${safeVideoTitle}\\${safeSlideTitle}\\${safeSlideTitle}${pageSuffix}.mp4`;
        } else {
            outputPath = `${safeVideoTitle}${pageSuffix}.mp4`;
        }

        // Build command
        const command = `dlm3u8.bat "${m3u8Url}" "${outputPath}"`;
        let safeCommand = "";
        for (let i = 0; i < command.length; i++) {
            safeCommand += command.charCodeAt(i) === 160 ? "-" : command.charAt(i);
        }

        // Copy command to clipboard and alert user
        navigator.clipboard.writeText(safeCommand)
            .then(() => {
                alert(`Command copied to clipboard:\\n\\n${safeCommand}`);
            })
            .catch(() => {
                prompt("Copy this command:", safeCommand);
            });
    } catch (err) {
        alert(`Error: ${err.message} - check console for details`);
    }
})();