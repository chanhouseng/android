-- phpMyAdmin SQL Dump
-- version 5.2.0
-- https://www.phpmyadmin.net/
--
-- Host: localhost:8889
-- Generation Time: Oct 31, 2023 at 08:53 AM
-- Server version: 5.7.39
-- PHP Version: 8.2.0

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `ghmc`
--

-- --------------------------------------------------------

--
-- Table structure for table `participants`
--

CREATE TABLE `participants` (
  `id` int(11) NOT NULL,
  `activityId` int(11) DEFAULT NULL,
  `participantName` varchar(255) DEFAULT NULL,
  `participantTrade` varchar(255) DEFAULT NULL,
  `participantRole` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Dumping data for table `participants`
--

INSERT INTO `participants` (`id`, `activityId`, `participantName`, `participantTrade`, `participantRole`) VALUES
(1, 5, '张三', '移动应用开发', '裁判'),
(2, 5, '李四', '网络安全', '意愿者'),
(3, 5, '王五', '移动应用开发', '参赛者'),
(4, 5, '赵六', '网络安全', '裁判'),
(5, 5, '孙七', '移动应用开发', '意愿者'),
(6, 5, '周八', '网络安全', '参赛者'),
(7, 5, '吴九', '移动应用开发', '裁判'),
(8, 5, '郑十', '网络安全', '意愿者'),
(9, 5, '王十一', '移动应用开发', '参赛者'),
(10, 5, '刘十二', '网络安全', '裁判');

-- --------------------------------------------------------

--
-- Table structure for table `tours`
--

CREATE TABLE `tours` (
  `activityId` int(11) NOT NULL,
  `activityName` varchar(255) DEFAULT NULL,
  `activityDate` date DEFAULT NULL,
  `activityType` varchar(255) DEFAULT NULL,
  `activityDescription` text,
  `maxParticipant` int(11) DEFAULT NULL,
  `joinedParticipant` int(11) DEFAULT '0',
  `presentNo` int(11) DEFAULT '0',
  `absentNo` int(11) DEFAULT '0',
  `isActive` varchar(1) NOT NULL DEFAULT '1'
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

--
-- Dumping data for table `tours`
--

INSERT INTO `tours` (`activityId`, `activityName`, `activityDate`, `activityType`, `activityDescription`, `maxParticipant`, `joinedParticipant`, `presentNo`, `absentNo`, `isActive`) VALUES
(1, '广州塔空中漫步', '2023-10-02', '户外活动', '在广州塔顶部体验惊心动魄的空中漫步。', 20, 15, 12, 3, '1'),
(2, '白云山徒步', '2023-10-18', '户外活动', '在广州市内的大自然中徒步，享受白云山的自然美景。', 30, 25, 23, 2, '1'),
(3, '珠江夜游', '2023-10-25', '历史参观', '乘坐游轮，在珠江上欣赏广州夜景。', 40, 35, 33, 2, '1'),
(4, '陈家祠参观', '2023-11-25', '历史参观', '参观广州著名的陈家祠，体验岭南建筑艺术。', 50, 0, 0, 0, '1'),
(5, '越秀公园野餐', '2023-11-30', '美食旅行', '在广州市中心的越秀公园享受轻松的野餐。', 30, 10, 0, 0, '1'),
(6, '广州动物园之旅', '2023-12-05', '户外活动', '参观广州动物园，近距离接触各种可爱的动物。', 40, 0, 0, 0, '1'),
(7, '广州美食之旅', '2023-12-10', '美食旅行', '沉浸在广州的美食文化中，品尝各种地道的广州美食。', 30, 0, 0, 0, '0');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `participants`
--
ALTER TABLE `participants`
  ADD PRIMARY KEY (`id`),
  ADD KEY `activityId` (`activityId`);

--
-- Indexes for table `tours`
--
ALTER TABLE `tours`
  ADD PRIMARY KEY (`activityId`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `participants`
--
ALTER TABLE `participants`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `tours`
--
ALTER TABLE `tours`
  MODIFY `activityId` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `participants`
--
ALTER TABLE `participants`
  ADD CONSTRAINT `participants_ibfk_1` FOREIGN KEY (`activityId`) REFERENCES `tours` (`activityId`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
