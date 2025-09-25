import  Holiday from '../models/Holiday';
const WorkSettings = require('../models/WorkSettings');
const { startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } = require('date-fns');

// Get all holidays
const getHolidays = async (req, res) => {
  try {
    const { month, year } = req.query;

    let query = {};

    // Filter by month and year if provided
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const holidays = await Holiday.find(query).sort({ date: 1 });
    res.json(holidays);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get holidays for a specific date range
const getHolidaysInRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }

    const holidays = await Holiday.find({
      date: { $gte: new Date(startDate), $lte: new Date(endDate) }
    }).sort({ date: 1 });

    res.json(holidays);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get month statistics
const getMonthStats = async (req, res) => {
  try {
    const { month, year } = req.query;

    if (!month || !year) {
      return res.status(400).json({ message: 'Month and year are required' });
    }

    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    
    // Get global work settings
    const workSettings = await WorkSettings.getGlobalSettings();
    const weeklyHolidays = workSettings.weeklyHolidays;

    // Get custom holidays for the month
    const customHolidays = await Holiday.find({
      date: { $gte: startDate, $lte: endDate }
    });

    // Calculate month days
    const monthDays = eachDayOfInterval({ start: startDate, end: endDate });
    
    const workDays = monthDays.filter(day => {
      const dayOfWeek = day.getDay();
      const isWeeklyHoliday = weeklyHolidays.includes(dayOfWeek);
      const isCustomHoliday = customHolidays.some(holiday => 
        isSameDay(new Date(holiday.date), day)
      );
      return !isWeeklyHoliday && !isCustomHoliday;
    }).length;

    const holidayDays = monthDays.length - workDays;

    res.json({
      workDays,
      holidayDays,
      totalDays: monthDays.length,
      customHolidays: customHolidays.length,
      weeklyHolidays: weeklyHolidays.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Create new holiday
const createHoliday = async (req, res) => {
  try {
    const { date, name, type, recurring } = req.body;

    // Validate required fields
    if (!date || !name || !type) {
      return res.status(400).json({ message: 'Date, name, and type are required' });
    }

    // Check if holiday already exists for this date
    const existingHoliday = await Holiday.findOne({ date: new Date(date) });
    if (existingHoliday) {
      return res.status(400).json({ message: 'Holiday already exists for this date' });
    }

    const holiday = new Holiday({
      date: new Date(date),
      name,
      type,
      recurring: recurring || false
    });

    const savedHoliday = await holiday.save();
    res.status(201).json(savedHoliday);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', error: error.message });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Update holiday
const updateHoliday = async (req, res) => {
  try {
    const { id } = req.params;
    const { date, name, type, recurring } = req.body;

    const holiday = await Holiday.findById(id);
    if (!holiday) {
      return res.status(404).json({ message: 'Holiday not found' });
    }

    // Check if date is being changed and if new date already has a holiday
    if (date && !isSameDay(new Date(date), holiday.date)) {
      const existingHoliday = await Holiday.findOne({ date: new Date(date) });
      if (existingHoliday) {
        return res.status(400).json({ message: 'Holiday already exists for this date' });
      }
    }

    // Update fields if provided
    if (date) holiday.date = new Date(date);
    if (name) holiday.name = name;
    if (type) holiday.type = type;
    if (recurring !== undefined) holiday.recurring = recurring;

    const updatedHoliday = await holiday.save();
    res.json(updatedHoliday);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: 'Validation error', error: error.message });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Delete holiday
const deleteHoliday = async (req, res) => {
  try {
    const { id } = req.params;

    const holiday = await Holiday.findByIdAndDelete(id);
    if (!holiday) {
      return res.status(404).json({ message: 'Holiday not found' });
    }

    res.json({ message: 'Holiday deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Get default holidays (initial data)
const getDefaultHolidays = async (req, res) => {
  try {
    const defaultHolidays = [
      {
        date: new Date(new Date().getFullYear(), 8, 23), // September 23
        name: 'اليوم الوطني السعودي',
        type: 'national',
        recurring: true
      },
      {
        date: new Date(new Date().getFullYear(), 3, 10), // April 10
        name: 'عيد الفطر',
        type: 'religious',
        recurring: false
      },
      {
        date: new Date(new Date().getFullYear(), 5, 16), // June 16
        name: 'عيد الأضحى',
        type: 'religious',
        recurring: false
      }
    ];

    res.json(defaultHolidays);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getHolidays,
  getHolidaysInRange,
  getMonthStats,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getDefaultHolidays
};