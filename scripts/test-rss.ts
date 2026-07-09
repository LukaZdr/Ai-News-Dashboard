import Parser from 'rss-parser';

const parser = new Parser({
  timeout: 10000,
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  },
  customFields: {
    item: [
      ['media:group', 'mediaGroup'],
    ]
  }
});

const url = 'https://www.youtube.com/feeds/videos.xml?channel_id=UChpleBmo18P08aKCIgti38g';

async function test() {
  try {
    const feed = await parser.parseURL(url);
    if (feed.items?.[0]) {
      console.log('Full first item:', JSON.stringify(feed.items[0], null, 2));
    }
  } catch (e) {
    console.log(`❌ FAILED: ${e.message}`);
  }
}

test();
