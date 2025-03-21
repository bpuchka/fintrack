-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema mydb
-- -----------------------------------------------------
-- -----------------------------------------------------
-- Schema fintrack
-- -----------------------------------------------------

-- -----------------------------------------------------
-- Schema fintrack
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `fintrack` DEFAULT CHARACTER SET utf8mb3 ;
USE `fintrack` ;

-- -----------------------------------------------------
-- Table `fintrack`.`users`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `fintrack`.`users` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `username` VARCHAR(45) NOT NULL,
  `email` VARCHAR(100) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `isAdmin` TINYINT(1) NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE INDEX `email_UNIQUE` (`email` ASC) VISIBLE)
ENGINE = InnoDB
AUTO_INCREMENT = 4
DEFAULT CHARACTER SET = utf8mb3;


-- -----------------------------------------------------
-- Table `fintrack`.`bank_investment`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `fintrack`.`bank_investment` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `amount` DECIMAL(15,2) NOT NULL,
  `interest_rate` DECIMAL(5,2) NOT NULL,
  `interest_type` ENUM('daily', 'monthly_1', 'monthly_3', 'monthly_6', 'yearly') NULL DEFAULT NULL,
  `notes` TEXT NULL DEFAULT NULL,
  `investment_date` DATE NOT NULL,
  `currency` VARCHAR(3) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `bank_investment_id_UNIQUE` (`id` ASC) VISIBLE,
  INDEX `fk_table1_Users` (`user_id` ASC) VISIBLE,
  CONSTRAINT `fk_table1_Users`
    FOREIGN KEY (`user_id`)
    REFERENCES `fintrack`.`users` (`id`)
    ON DELETE CASCADE)
ENGINE = InnoDB
AUTO_INCREMENT = 4
DEFAULT CHARACTER SET = utf8mb3;


-- -----------------------------------------------------
-- Table `fintrack`.`blog_post`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `fintrack`.`blog_post` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `author_id` INT NOT NULL,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  `content` TEXT NOT NULL,
  `updated_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `title` TEXT NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `fk_blog_post_Users1_idx` (`author_id` ASC) VISIBLE,
  CONSTRAINT `fk_blog_post_Users1`
    FOREIGN KEY (`author_id`)
    REFERENCES `fintrack`.`users` (`id`))
ENGINE = InnoDB
AUTO_INCREMENT = 5
DEFAULT CHARACTER SET = utf8mb3;


-- -----------------------------------------------------
-- Table `fintrack`.`investment_prices`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `fintrack`.`investment_prices` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `symbol` VARCHAR(10) NOT NULL,
  `price` DECIMAL(10,2) NOT NULL,
  `timestamp` DATETIME NOT NULL,
  `asset_type` ENUM('stock', 'crypto', 'commodity', 'forex', 'etf') NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `symbol` (`symbol` ASC, `timestamp` ASC) VISIBLE)
ENGINE = InnoDB
AUTO_INCREMENT = 3431
DEFAULT CHARACTER SET = utf8mb3;


-- -----------------------------------------------------
-- Table `fintrack`.`user_investments`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `fintrack`.`user_investments` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `user_id` INT NOT NULL,
  `investment_type` ENUM('bank', 'crypto', 'stock', 'metal') NOT NULL,
  `symbol` VARCHAR(10) NOT NULL COMMENT 'Asset symbol (e.g., BTC, AAPL) or bank reference',
  `quantity` DECIMAL(14,4) NOT NULL,
  `purchase_price` DECIMAL(10,2) NOT NULL COMMENT 'Price per unit or set to 1 for bank deposits',
  `currency` ENUM('BGN', 'USD', 'EUR', 'GBP') NULL DEFAULT NULL COMMENT 'Currency for bank deposits',
  `purchase_date` DATETIME NOT NULL,
  `notes` TEXT NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  INDEX `user_id` (`user_id` ASC) VISIBLE,
  INDEX `idx_investment_type` (`investment_type` ASC) VISIBLE,
  CONSTRAINT `user_investments_ibfk_1`
    FOREIGN KEY (`user_id`)
    REFERENCES `fintrack`.`users` (`id`))
ENGINE = InnoDB
AUTO_INCREMENT = 10
DEFAULT CHARACTER SET = utf8mb3
COMMENT = 'Stores all user investment types including cryptocurrencies, stocks, metals, and bank deposits';

USE `fintrack` ;

-- -----------------------------------------------------
-- Placeholder table for view `fintrack`.`all_investments`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `fintrack`.`all_investments` (`id` INT, `user_id` INT, `investment_type` INT, `symbol` INT, `quantity` INT, `purchase_price` INT, `currency` INT, `interest_rate` INT, `interest_type` INT, `purchase_date` INT, `notes` INT);

-- -----------------------------------------------------
-- View `fintrack`.`all_investments`
-- -----------------------------------------------------
DROP TABLE IF EXISTS `fintrack`.`all_investments`;
USE `fintrack`;
CREATE  OR REPLACE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `fintrack`.`all_investments` AS select `fintrack`.`bank_investment`.`id` AS `id`,`fintrack`.`bank_investment`.`user_id` AS `user_id`,'bank' AS `investment_type`,concat('BANK_',`fintrack`.`bank_investment`.`currency`) AS `symbol`,`fintrack`.`bank_investment`.`amount` AS `quantity`,1 AS `purchase_price`,`fintrack`.`bank_investment`.`currency` AS `currency`,`fintrack`.`bank_investment`.`interest_rate` AS `interest_rate`,`fintrack`.`bank_investment`.`interest_type` AS `interest_type`,`fintrack`.`bank_investment`.`investment_date` AS `purchase_date`,`fintrack`.`bank_investment`.`notes` AS `notes` from `fintrack`.`bank_investment` union all select `fintrack`.`user_investments`.`id` AS `id`,`fintrack`.`user_investments`.`user_id` AS `user_id`,`fintrack`.`user_investments`.`investment_type` AS `investment_type`,`fintrack`.`user_investments`.`symbol` AS `symbol`,`fintrack`.`user_investments`.`quantity` AS `quantity`,`fintrack`.`user_investments`.`purchase_price` AS `purchase_price`,`fintrack`.`user_investments`.`currency` AS `currency`,`fintrack`.`user_investments`.`interest_rate` AS `interest_rate`,`fintrack`.`user_investments`.`interest_type` AS `interest_type`,`fintrack`.`user_investments`.`purchase_date` AS `purchase_date`,`fintrack`.`user_investments`.`notes` AS `notes` from `fintrack`.`user_investments` where (`fintrack`.`user_investments`.`investment_type` <> 'bank');

SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
