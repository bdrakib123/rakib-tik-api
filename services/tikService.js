const axios = require("axios");

const getNoWatermark = async (url) => {
  const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;

  const response = await axios.get(apiUrl);

  if (!response.data || !response.data.data) {
    throw new Error("Invalid TikTok URL");
  }

  const video = response.data.data;

  return {
    title: video.title,
    author: video.author.nickname,
    thumbnail: video.cover,
    no_watermark: video.play,
    music: video.music
  };
};

module.exports = { getNoWatermark };
