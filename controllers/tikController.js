const { getNoWatermark } = require("../services/tikService");

exports.downloadTik = async (req, res) => {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({
      status: false,
      message: "TikTok URL is required"
    });
  }

  try {
    const data = await getNoWatermark(url);

    res.json({
      status: true,
      creator: "Rakib Tik API",
      data: data
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: "Failed to fetch video"
    });
  }
};
